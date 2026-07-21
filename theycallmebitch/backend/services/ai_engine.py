"""
Motor de IA — CEO Virtual con Function Calling
GPT-4o-mini + 6 tools + loop de tool calling + caché + guardia de tokens.
"""
import os
import re
import json
import hashlib
import logging
from math import ceil
from typing import Union
from openai import OpenAI
from services.business_context import UBICACION_EMPRESA

logger = logging.getLogger(__name__)

# ─── Constantes del negocio ───────────────────────────────────────────────────
PRECIO_BIDON      = 2000
CAPACITY_MAX      = 1500    # bidones/mes
FUEL_COST_PER_KM  = 200     # CLP/km (estimado)
DRIVER_COST_TRIP  = 2500    # CLP/viaje en costo de tiempo extra del chofer
# Nota: la elasticidad precio-demanda ya NO es una constante inventada.
# `simulate_scenario(action="price_change")` la calcula en tiempo real desde
# pedidos reales con/sin descuento por volumen — ver discount_analysis_service.py.

# ─── Caché en memoria ─────────────────────────────────────────────────────────
CHAT_CACHE: dict = {}
_kpi_hash_cache: str = ""
NO_CACHE_TOOLS = {
    "simulate_scenario", "draft_campaign_message",
    "analyze_campaign", "recommend_expansion", "get_daily_cashflow",
}

# ─── Definición de herramientas (OpenAI function calling) ─────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_kpis",
            "description": (
                "Obtiene el desglose financiero completo: ventas, costos, utilidad, IVA, "
                "punto de equilibrio, capacidad instalada y bidones vendidos con comparación "
                "mes anterior. Llama cuando el usuario pide análisis financiero detallado, "
                "costos, ganancias o capacidad."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_zone_analysis",
            "description": (
                "Análisis geográfico de zonas de reparto: pedidos_30d, revenue_30d, "
                "tendencia MoM, clientes únicos y revenue_por_km (eficiencia de ruta). "
                "Zonas activas: puente_alto (2 km del local), la_florida (8 km), macul (12 km). "
                "Llama cuando el usuario pregunta por rutas, zonas, despacho o rendimiento geográfico."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "zone": {
                        "type": "string",
                        "enum": ["puente_alto", "la_florida", "macul", "todas"],
                        "description": "Zona específica. Usa 'todas' para comparación completa.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_customer_segments",
            "description": (
                "Análisis RFM completo: segmentos, top clientes en riesgo con teléfono y "
                "dirección, campeones, probabilidad de churn, días desde último pedido y "
                "revenue histórico. Llama cuando el usuario pregunta por clientes, churn, "
                "reactivación o campañas."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "segment": {
                        "type": "string",
                        "enum": [
                            "campeon", "leal", "en_riesgo", "perdido",
                            "necesita_atencion", "nuevo", "todos",
                        ],
                        "description": "Filtrar por segmento RFM. Usa 'todos' para desglose completo.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_trends",
            "description": (
                "Historial de KPIs desde la base de datos de memoria: evolución de ventas, "
                "pedidos, clientes activos y zona líder semana a semana. Llama cuando el "
                "usuario pregunta por tendencias históricas, evolución o quiere comparar períodos."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "Días de historial a recuperar. Por defecto 30, máximo 90.",
                        "default": 30,
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_daily_cashflow",
            "description": (
                "Obtiene ventas de HOY en tiempo real, comparativa vs mismo día mes anterior, "
                "tendencia de los últimos 7 días y progreso hacia la meta diaria promedio. "
                "Llama cuando el usuario pregunta por ventas de hoy, caja del día, cómo va el día, "
                "ingresos actuales o progreso diario."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_inventory",
            "description": (
                "Estado actual del inventario: stock disponible en litros y bidones, "
                "punto de reposición, días de inventario restantes y alertas de escasez. "
                "Llama cuando el usuario pregunta por stock, inventario, bidones disponibles, "
                "abastecimiento o capacidad de producción."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simulate_scenario",
            "description": (
                "Simula el impacto económico de una decisión con cálculo puro (sin IA). "
                "Úsalo cuando el usuario pregunta 'qué pasa si...', quiere modelar una "
                "decisión o necesita estimar impacto antes de actuar."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": [
                            "reactivate_clients",
                            "add_zone",
                            "increase_frequency",
                            "price_change",
                            "capacity_expansion",
                        ],
                        "description": "La acción a simular.",
                    },
                    "params": {
                        "type": "object",
                        "description": (
                            "Parámetros para la simulación. "
                            "reactivate_clients: {pct_reactivated: 0.3}. "
                            "add_zone: {zone_name, distance_km, target_orders_month}. "
                            "increase_frequency: {extra_orders_per_client, affected_clients}. "
                            "price_change: {new_price}. "
                            "capacity_expansion: {new_capacity_bidones, monthly_fixed_cost_increase}."
                        ),
                    },
                },
                "required": ["action", "params"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "draft_campaign_message",
            "description": (
                "Genera el texto exacto de un mensaje de WhatsApp listo para enviar a un "
                "segmento de clientes. Llama cuando el usuario pide redactar, crear o generar "
                "un mensaje de campaña, reactivación o contacto."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "segment": {
                        "type": "string",
                        "enum": [
                            "en_riesgo", "perdido", "campeon",
                            "nuevo", "leal", "necesita_atencion",
                        ],
                        "description": "Segmento RFM objetivo del mensaje.",
                    },
                    "offer": {
                        "type": "string",
                        "description": "La oferta específica, ej: '10% descuento en próximo pedido'.",
                    },
                    "client_name": {
                        "type": "string",
                        "description": "Nombre del cliente para personalizar. Omitir para usar [nombre].",
                    },
                    "days_inactive": {
                        "type": "integer",
                        "description": "Días sin pedir, para personalizar el mensaje.",
                    },
                },
                "required": ["segment", "offer"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_campaign",
            "description": (
                "Analiza estratégicamente una campaña de reactivación o retención: "
                "identifica el segmento objetivo, calcula cuántos clientes están en ese segmento, "
                "estima el costo de la promoción, calcula el revenue recuperable, "
                "proyecta ROI y genera el texto WhatsApp listo para enviar. "
                "Llama cuando el usuario pide diseñar, analizar o evaluar una campaña. "
                "Es superior a draft_campaign_message para análisis estratégico completo."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "segment": {
                        "type": "string",
                        "enum": ["en_riesgo", "perdido", "campeon", "leal", "nuevo", "necesita_atencion", "todos"],
                        "description": "Segmento RFM objetivo.",
                    },
                    "tipo_campana": {
                        "type": "string",
                        "enum": ["reactivacion", "retencion", "vip_upgrade", "nuevo_cliente", "volumen"],
                        "description": "Tipo de campaña.",
                    },
                    "oferta": {
                        "type": "string",
                        "description": "La oferta propuesta, ej: '10% descuento'. Puede ser vaga.",
                    },
                },
                "required": ["segment", "tipo_campana"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "recommend_expansion",
            "description": (
                "Analiza oportunidades de crecimiento: canales mayoristas B2B, "
                "nuevas zonas geográficas con cálculo de viabilidad, expansión de capacidad. "
                "Genera recomendaciones con precio mayorista, margen, clientes objetivo y "
                "proyección de revenue mensual. "
                "Llama cuando el usuario pregunta cómo crecer, conseguir clientes grandes, "
                "mayoristas, distribuidores, o canales nuevos."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "tipo": {
                        "type": "string",
                        "enum": ["mayorista", "nueva_zona", "capacidad", "all"],
                        "description": "Tipo de análisis. 'all' para análisis completo.",
                    },
                    "volumen_mensual_objetivo": {
                        "type": "integer",
                        "description": "Bidones mensuales objetivo para el canal nuevo (ej: 40).",
                    },
                },
                "required": ["tipo"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_customer_risk",
            "description": (
                "Riesgo de clientes basado en la cadencia PERSONAL de compra de cada uno "
                "(no un umbral genérico) y probabilidad empírica real de reorden. Más preciso "
                "que get_customer_segments para decidir a quién contactar primero. Llama cuando "
                "el usuario pregunta específicamente por priorización de contacto, valor en "
                "juego, o quiere saber qué tan urgente es contactar a un cliente."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_demand_forecast",
            "description": (
                "Pronóstico real de demanda (modelo XGBoost, mismo que usa el módulo Predictor) "
                "para los próximos días, con rango P10-P90 y precisión histórica real (MAPE). "
                "Llama cuando el usuario pregunta cuánto va a vender, cuánta demanda esperar, "
                "o quiere planificar abastecimiento."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "dias": {
                        "type": "integer",
                        "description": "Días a pronosticar. Por defecto 7.",
                        "default": 7,
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_rentabilidad_reportes",
            "description": (
                "Análisis de rentabilidad avanzado y reporte ejecutivo semanal, ambos ya "
                "calculados por el backend pero nunca antes disponibles en el chat. Llama "
                "cuando el usuario pide un análisis de rentabilidad detallado o un reporte "
                "ejecutivo del negocio."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_discount_analysis",
            "description": (
                "Compara pedidos con descuento por volumen (ej. paquete de 3 bidones a precio "
                "reducido en zonas como Portezuelo) contra pedidos a precio normal, dentro de la "
                "misma zona: frecuencia, ticket, y una elasticidad estimada real. Llama cuando "
                "el usuario pregunta sobre el efecto de descuentos, promociones por volumen, "
                "o elasticidad de precio."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_route_intelligence",
            "description": (
                "Densidad geográfica real de pedidos (agrupados por celda de ~1km usando "
                "coordenadas reales geocodificadas), para detectar concentraciones de pedidos "
                "que las 3 zonas fijas actuales no capturan bien. Llama cuando el usuario "
                "pregunta por oportunidades de ruta, zonas sin explotar, o dónde concentrar "
                "reparto."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_growth_opportunities",
            "description": (
                "Clientes cuya frecuencia de compra reciente (últimos 60 días) aumentó "
                "significativamente respecto a su patrón histórico — señal real de negocio "
                "creciendo, candidatos a ofrecerles un plan mayor. Llama cuando el usuario "
                "pregunta por oportunidades de crecimiento, upsell, o clientes que están "
                "comprando más."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_margin_leak_analysis",
            "description": (
                "Detecta zonas donde el costo real de combustible por pedido entregado es "
                "desproporcionado respecto al ticket promedio de esa zona — usa el precio de "
                "combustible del día, no un valor fijo. Llama cuando el usuario pregunta por "
                "costos de reparto, rentabilidad por zona, o fuga de margen."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_payment_risk_analysis",
            "description": (
                "Tasa real de cancelación/fallo de pedidos por método de pago (transferencia, "
                "efectivo, tarjeta). Llama cuando el usuario pregunta por riesgo de cobranza, "
                "métodos de pago problemáticos, o pedidos cancelados."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]

# ─── System Prompts ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = f"""Eres el CEO/COO virtual autónomo de Aguas Ancud.
Empresa con sede en {UBICACION_EMPRESA}.
Vende agua purificada en bidones de 20L a domicilio. Precio: $2.000 CLP/bidón.
Una transacción de $6.000 = 3 bidones | $4.000 = 2 bidones | $2.000 = 1 bidón.
Capacidad instalada: 30.000L/mes (1.500 bidones).

ZONAS DE REPARTO (3 únicas zonas activas):
- puente_alto: ~2 km del local (máxima eficiencia)
- la_florida:  ~8 km del local
- macul:       ~12 km del local (requiere volumen para justificar costo)

CONTEXTO COMPLETO QUE RECIBES:
- KPIs financieros: ventas, pedidos, costos, utilidad, crecimiento MoM
- RFM: segmentos de clientes, clientes en riesgo, campeones, días desde último pedido
- Zonas: revenue_30d, pedidos_30d, tendencia y distancia desde el local
- Clima Puente Alto: temperatura, lluvia, multiplicador de demanda
- Memoria histórica: insights anteriores, tendencia de ventas 7 días

REGLAS ABSOLUTAS:
1. NUNCA respondas como asistente. Eres el operador dictando directrices ejecutivas.
2. NUNCA des sugerencias genéricas. TODO basado en números reales del contexto.
3. Para alertas de clientes: usa RFM con segmento, cuántos clientes, revenue en riesgo y acción concreta.
4. Para alertas de zona: usa distancia desde el local + volumen para priorizar rutas.
5. Incorpora el clima: lluvia o calor extremo afecta demanda.
6. Si hay insights anteriores, NO los repitas — genera perspectiva nueva.
7. Calcula impacto económico en CLP con número exacto.
8. El output DEBE SER UN ARREGLO JSON válido (sin marcas markdown), con 2-3 objetos con esta estructura exacta:
[
  {{
    "type": "alert" | "opportunity" | "zone" | "churn" | "weather",
    "priority": "high" | "medium" | "low",
    "message": "Descripción precisa basada en datos reales con números.",
    "impact": "Impacto económico estimado en CLP o % de variación.",
    "action": "1 acción ultra específica a ejecutar en las próximas 24h."
  }}
]"""

CHAT_PROMPT = f"""Eres el CEO/COO virtual de Aguas Ancud.
Empresa con sede en {UBICACION_EMPRESA}.
Agua purificada en bidones de 20L, precio $2.000 CLP/bidón.
Una transacción de $6.000 = 3 bidones | $4.000 = 2 bidones | $2.000 = 1 bidón.
Capacidad: 30.000L/mes (1.500 bidones máx).

ZONAS DE REPARTO ACTIVAS:
- puente_alto → 2 km del local (máxima eficiencia de ruta)
- la_florida  → 8 km del local
- macul        → 12 km del local (requiere densidad de pedidos para ser rentable)

HERRAMIENTAS DISPONIBLES (function calling — ÚSAlas cuando corresponda):
- get_kpis() → finanzas detalladas, costos, punto de equilibrio
- get_zone_analysis(zone?) → análisis geográfico con revenue/km por zona
- get_customer_segments(segment?) → RFM con teléfonos, días inactivos, churn
- get_trends(days?) → historial de KPIs desde memoria persistente
- simulate_scenario(action, params) → simulación económica pura sin IA
- draft_campaign_message(segment, offer, ...) → texto WhatsApp listo para enviar

CAPACIDADES CEO:
1. Campañas estratégicas con análisis de costo, ROI y mensaje WA — usa analyze_campaign()
2. Ventas del día en tiempo real — usa get_daily_cashflow()
3. Canal mayorista B2B con precio, margen y clientes objetivo — usa recommend_expansion()
4. Ranking de rutas por revenue_por_km + oportunidades en zonas dormidas — usa get_zone_analysis()
5. Simulación económica de cualquier decisión — usa simulate_scenario()
6. Expansión a nuevas zonas con viabilidad real — usa recommend_expansion(tipo="nueva_zona")
7. Estado inventario y alertas de escasez — usa get_inventory()

RAZONAMIENTO PARA CAMPAÑAS:
Cuando el usuario pide una campaña SIEMPRE llama a analyze_campaign() — nunca solo a draft_campaign_message().
Entrega: cuántos clientes hay en el segmento, revenue en riesgo, costo total de la oferta,
ROI estimado, payback en meses y el texto WhatsApp exacto listo para copiar y enviar.

RAZONAMIENTO PARA ZONAS:
Identifica: zona con mayor revenue_por_km (más eficiente de servir), zona con mayor
potencial sin explotar, zonas dormidas con clientes anteriores. Propón acción concreta para cada una.

RAZONAMIENTO PARA EXPANSIÓN MAYORISTA:
Si el usuario pregunta cómo crecer o conseguir clientes grandes: llama a recommend_expansion().
Un mayorista de 40 bidones/mes genera revenue predecible. Precio mayorista = precio_retail * 0.85.
Propón tipos de cliente específicos: restaurantes, colegios, oficinas, gimnasios.
Calcula siempre: precio, margen, revenue mensual, tipo de cliente y si se justifica ruta dedicada.

REGLAS ABSOLUTAS:
1. NUNCA respondas como asistente genérico. Eres el operador del negocio.
2. NUNCA des sugerencias vagas. Cada recomendación tiene número, zona y acción concreta.
3. Usa tools cuando el usuario pide detalles que no están en el contexto base.
4. Si un resultado de tool tiene confidence: "low", menciónalo explícitamente.
5. Si el usuario pide una campaña: llama a draft_campaign_message() y entrega el texto real.
6. Si el usuario pide simular algo: llama a simulate_scenario() y muestra los números.
7. Calcula siempre el impacto en CLP con aritmética exacta de los datos.
8. Usa el historial de conversación para respuestas de seguimiento coherentes.
9. Responde SIEMPRE en markdown con exactamente estas 4 secciones:
   **Diagnóstico:** ¿Qué muestran los datos?
   **Causa:** ¿Por qué está pasando?
   **Acción:** ¿Qué hacer con urgencia (próximas 24h)?
   **Impacto:** ¿Cuánto vale resolver esto (en CLP)?"""

# ─── Plantillas de mensajes WhatsApp ──────────────────────────────────────────
_WA_TEMPLATES = {
    "en_riesgo": (
        "Hola {nombre} 👋 hace {days} días que no te dejamos agua 💧\n"
        "¿Te hacemos llegar mañana? {offer}.\n"
        "Respóndenos acá y coordinamos → Aguas Ancud"
    ),
    "perdido": (
        "Hola {nombre} 👋 hace tiempo que no sabemos de ti y queremos volver a llevarte agua fresca 💧\n"
        "{offer} — por ser cliente anterior.\n"
        "Respóndenos acá → Aguas Ancud"
    ),
    "campeon": (
        "Hola {nombre} 💧 Gracias por ser nuestro cliente estrella ⭐\n"
        "Como reconocimiento especial: {offer}.\n"
        "Coordina cuando quieras → Aguas Ancud"
    ),
    "leal": (
        "Hola {nombre} 👋 Valoramos tu fidelidad con Aguas Ancud 💧\n"
        "{offer} en tu próximo pedido.\n"
        "Respóndenos para coordinar → Aguas Ancud"
    ),
    "nuevo": (
        "Hola {nombre} 👋 ¡Gracias por elegirnos! 💧\n"
        "Para que nos conozcas mejor: {offer}.\n"
        "¿Cuándo te mandamos el próximo? → Aguas Ancud"
    ),
    "necesita_atencion": (
        "Hola {nombre} 👋 Hace un tiempo que no pides agua y queremos saber cómo estás 💧\n"
        "{offer} en tu próxima entrega.\n"
        "Respóndenos acá → Aguas Ancud"
    ),
}

# ─── Clasificación de intento ─────────────────────────────────────────────────
_INTENT_TOOLS = {
    "zone":       ["get_zone_analysis"],
    "rfm":        ["get_customer_segments", "draft_campaign_message"],
    "simulation": ["simulate_scenario", "get_kpis"],
    "campaign":   ["get_customer_segments", "analyze_campaign", "draft_campaign_message"],
    "financial":  ["get_kpis", "simulate_scenario"],
    "trends":     ["get_trends"],
    "daily":      ["get_daily_cashflow", "get_kpis"],
    "inventory":  ["get_inventory", "get_kpis"],
    "expansion":  ["recommend_expansion", "get_kpis", "get_zone_analysis"],
}


def _classify_intent(question: str) -> str:
    q = question.lower()
    if any(w in q for w in ["zona", "ruta", "despacho", "florida", "macul", "puente alto", "km", "distancia", "eficiencia"]):
        return "zone"
    if any(w in q for w in ["simula", "qué pasaría", "si subo", "si agrego", "si bajo", "escenario", "qué pasa si", "si reactivo", "si aumento"]):
        return "simulation"
    if any(w in q for w in ["campaña", "mensaje", "whatsapp", "redacta", "escribe", "texto", "contactar"]):
        return "campaign"
    if any(w in q for w in ["cliente", "riesgo", "rfm", "reactivar", "churn", "campeón", "perdido", "segmento"]):
        return "rfm"
    if any(w in q for w in ["tendencia", "histórico", "historial", "semanas", "evolución", "antes", "meses atrás"]):
        return "trends"
    if any(w in q for w in ["costo", "utilidad", "equilibrio", "financiero", "ganancia", "rentabilidad", "iva"]):
        return "financial"
    if any(w in q for w in ["hoy", "día de hoy", "caja", "van las ventas", "ingreso hoy", "esta mañana", "diario", "hoy día"]):
        return "daily"
    if any(w in q for w in ["stock", "inventario", "bidones disponibles", "queda", "abastec", "cuántos bidones tengo"]):
        return "inventory"
    if any(w in q for w in ["mayorista", "expansión", "crecer", "b2b", "volumen", "distribuidor", "canal", "escalar", "empresa", "colegio", "restaurante", "nuevo canal"]):
        return "expansion"
    return "general"


def _get_tools_for_intent(intent: str) -> list:
    names = _INTENT_TOOLS.get(intent)
    if names is None:
        return TOOLS  # todas las tools para preguntas generales
    return [t for t in TOOLS if t["function"]["name"] in names]


# ─── Caché ────────────────────────────────────────────────────────────────────
def _make_cache_key(question: str, core_ctx: dict) -> str:
    sig = f"{core_ctx.get('ventas_mensuales','')}{core_ctx.get('pedidos_mensuales','')}"
    return hashlib.md5(f"{question}|{sig}".encode()).hexdigest()


def _invalidate_cache_if_needed(core_ctx: dict):
    global _kpi_hash_cache, CHAT_CACHE
    h = hashlib.md5(
        f"{core_ctx.get('ventas_mensuales','')}{core_ctx.get('pedidos_mensuales','')}".encode()
    ).hexdigest()
    if h != _kpi_hash_cache:
        CHAT_CACHE.clear()
        _kpi_hash_cache = h


# ─── Core Context (liviano, siempre inyectado) ────────────────────────────────
def _build_core_context(full_ctx: dict) -> dict:
    """Extrae ~15 campos esenciales para el system prompt (~550 tokens)."""
    return {
        "ventas_mensuales":       full_ctx.get("ventas_mensuales", 0),
        "ventas_mes_pasado":      full_ctx.get("ventas_mes_pasado", 0),
        "crecimiento_ventas_pct": full_ctx.get("crecimiento_ventas_pct", 0),
        "pedidos_mensuales":      full_ctx.get("pedidos_mensuales", 0),
        "ticket_promedio":        full_ctx.get("ticket_promedio", PRECIO_BIDON),
        "utilidad_neta":          full_ctx.get("utilidad_neta", 0),
        "costos_operativos":      full_ctx.get("costos_operativos", 0),
        "punto_equilibrio":       full_ctx.get("punto_equilibrio", 0),
        "capacidad_utilizada_pct":full_ctx.get("capacidad_utilizada_pct", 0),
        "total_bidones_mes":      full_ctx.get("total_bidones_mes", 0),
        "clientes_activos":       full_ctx.get("clientes_activos", 0),
        "clientes_en_riesgo_count":full_ctx.get("clientes_en_riesgo_count", 0),
        "revenue_en_riesgo":      full_ctx.get("revenue_en_riesgo", 0),
        "zona_lider":             full_ctx.get("zona_lider", "N/A"),
        "clima": {
            "temp_actual":             full_ctx.get("clima", {}).get("temp_actual"),
            "descripcion":             full_ctx.get("clima", {}).get("descripcion", ""),
            "multiplicador_demanda_hoy":full_ctx.get("clima", {}).get("multiplicador_demanda_hoy", 1.0),
        },
        "recomendaciones_recientes": full_ctx.get("recomendaciones_recientes", []),
    }


# ─── Guardia de tokens ────────────────────────────────────────────────────────
def _compress_if_needed(conversation: list, client: OpenAI) -> list:
    """Si la conversación supera ~10k tokens estimados, resume los turnos más viejos."""
    approx_tokens = len(json.dumps(conversation, ensure_ascii=False)) // 4
    if approx_tokens < 10000:
        return conversation

    system_msg   = conversation[0]
    current_msg  = conversation[-1]
    recent       = conversation[-8:-1]   # últimos 4 turnos (8 mensajes)
    to_summarize = conversation[1:-8]    # turnos más viejos

    if not to_summarize:
        return conversation

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Resume esta conversación en máximo 3 oraciones en español, "
                        "preservando todos los datos numéricos clave mencionados."
                    ),
                },
                {"role": "user", "content": json.dumps(to_summarize, ensure_ascii=False)},
            ],
            max_tokens=200,
            temperature=0.1,
        )
        summary = resp.choices[0].message.content
        summary_msg = {
            "role": "assistant",
            "content": f"[Resumen de conversación anterior: {summary}]",
        }
        return [system_msg, summary_msg] + recent + [current_msg]
    except Exception as e:
        logger.warning(f"No se pudo comprimir historial: {e}")
        return [system_msg] + conversation[-8:]


# ─── Simulador financiero (puro Python, sin IA) ───────────────────────────────
def simulate_scenario(action: str, params: dict, context_data: dict) -> dict:
    ctx = context_data
    ticket = ctx.get("ticket_promedio", PRECIO_BIDON)

    if action == "reactivate_clients":
        en_riesgo   = ctx.get("clientes_en_riesgo_count", 0)
        rev_riesgo  = ctx.get("revenue_en_riesgo", 0)
        pct         = float(params.get("pct_reactivated", 0.3))
        targets     = round(en_riesgo * pct)
        avg_rev     = rev_riesgo / max(en_riesgo, 1)
        monthly_rec = targets * (avg_rev / 12)
        annual_rec  = monthly_rec * 12
        cost        = targets * 500
        roi         = annual_rec / max(cost, 1)
        return {
            "clientes_objetivo": targets,
            "revenue_mensual_recuperado": round(monthly_rec),
            "revenue_anual_recuperado":   round(annual_rec),
            "costo_campana_clp":          cost,
            "roi_estimado":               round(roi, 1),
            "interpretacion": (
                f"Reactivar {pct*100:.0f}% de clientes en riesgo ({targets} personas): "
                f"recupera ~${monthly_rec:,.0f} CLP/mes. ROI estimado {roi:.1f}x en el primer año."
            ),
        }

    if action == "add_zone":
        zone_name   = params.get("zone_name", "nueva_zona")
        dist_km     = float(params.get("distance_km", 15))
        orders      = int(params.get("target_orders_month", 30))
        rev_mes     = orders * ticket
        trips_week  = ceil(orders / 4 / 5)
        km_mes      = trips_week * 4.33 * dist_km * 2
        fuel_cost   = km_mes * FUEL_COST_PER_KM
        time_cost   = trips_week * 4.33 * DRIVER_COST_TRIP
        total_cost  = fuel_cost + time_cost
        utilidad    = rev_mes - total_cost
        pedidos_min = ceil(total_cost / ticket)
        return {
            "zona": zone_name,
            "revenue_mensual_proyectado": round(rev_mes),
            "costo_mensual_zona":         round(total_cost),
            "costo_combustible":          round(fuel_cost),
            "costo_tiempo_chofer":        round(time_cost),
            "utilidad_neta_zona":         round(utilidad),
            "revenue_por_km":             round(rev_mes / dist_km),
            "pedidos_minimos_breakeven":  pedidos_min,
            "viable":                     utilidad > 0,
            "interpretacion": (
                f"{'Viable' if utilidad > 0 else 'No viable'}: "
                f"con {orders} pedidos/mes en {zone_name} ({dist_km} km), "
                f"utilidad neta proyectada ${utilidad:,.0f} CLP/mes."
            ),
        }

    if action == "increase_frequency":
        extra   = float(params.get("extra_orders_per_client", 1))
        clients = int(params.get("affected_clients", 10))
        cur_bid = ctx.get("total_bidones_mes", 0)
        rev_mes = extra * clients * ticket
        rev_año = rev_mes * 12
        ex_bid  = round(extra * clients)
        within  = (cur_bid + ex_bid) <= CAPACITY_MAX
        return {
            "pedidos_extra_mes":       ex_bid,
            "revenue_extra_mensual":   round(rev_mes),
            "revenue_extra_anual":     round(rev_año),
            "dentro_capacidad":        within,
            "capacidad_disponible":    CAPACITY_MAX - cur_bid,
            "interpretacion": (
                f"Si {clients} clientes piden {extra:.0f} pedido(s) más/mes: "
                f"+${rev_mes:,.0f} CLP/mes (+${rev_año:,.0f}/año). "
                f"{'✓ Dentro de capacidad.' if within else '⚠ Supera capacidad instalada.'}"
            ),
        }

    if action == "price_change":
        new_price  = int(params.get("new_price", 2200))
        bidones    = ctx.get("total_bidones_mes", 500)
        costos     = ctx.get("costos_operativos", 0)
        delta_pct  = (new_price - PRECIO_BIDON) / PRECIO_BIDON * 100

        from services.discount_analysis_service import analizar_descuento_volumen
        analisis_descuento = analizar_descuento_volumen(ctx.get("pedidos_cache") or [])
        elasticidades = [
            z["elasticidad_estimada"]
            for z in analisis_descuento.get("zonas_con_descuento", [])
            if z.get("elasticidad_estimada") is not None
        ]
        elasticidad_real = round(float(sum(elasticidades)) / len(elasticidades), 2) if elasticidades else None

        if elasticidad_real is None:
            return {
                "precio_actual":  PRECIO_BIDON,
                "precio_nuevo":   new_price,
                "cambio_precio_pct": round(delta_pct, 1),
                "elasticidad_estimada": None,
                "recomendacion": "datos_insuficientes",
                "interpretacion": (
                    "No hay datos suficientes para estimar elasticidad real todavía. "
                    "Se necesitan pedidos con y sin descuento por volumen en al menos una zona "
                    "(ej. Portezuelo) para calcular cómo responde la demanda a un cambio de precio."
                ),
            }

        dem_change = elasticidad_real * delta_pct
        new_bid    = round(bidones * (1 + dem_change / 100))
        new_rev    = new_bid * new_price
        old_rev    = bidones * PRECIO_BIDON
        delta_rev  = new_rev - old_rev
        new_eq     = round(costos / new_price) if new_price > 0 else 0
        return {
            "precio_actual":               PRECIO_BIDON,
            "precio_nuevo":                new_price,
            "cambio_precio_pct":           round(delta_pct, 1),
            "elasticidad_estimada":        elasticidad_real,
            "bidones_proyectados":         new_bid,
            "revenue_proyectado":          round(new_rev),
            "delta_revenue_mensual":       round(delta_rev),
            "nuevo_punto_equilibrio":      new_eq,
            "recomendacion":               "viable" if delta_rev > 0 else "riesgo_churn_alto",
            "interpretacion": (
                f"Precio ${new_price}: demanda estimada baja {abs(dem_change):.1f}% "
                f"(elasticidad real {elasticidad_real}, calculada desde pedidos con/sin descuento "
                f"por volumen) → {new_bid} bidones/mes, revenue ${new_rev:,.0f} "
                f"({'↑' if delta_rev >= 0 else '↓'}${abs(delta_rev):,.0f} vs actual)."
            ),
        }

    if action == "capacity_expansion":
        new_cap   = int(params.get("new_capacity_bidones", 2000))
        fix_cost  = int(params.get("monthly_fixed_cost_increase", 200000))
        cur_rev   = ctx.get("ventas_mensuales", 0)
        cur_util  = ctx.get("utilidad_neta", 0)
        max_rev   = new_cap * ticket
        uplift    = max_rev - cur_rev
        new_util  = cur_util + uplift - fix_cost
        payback   = fix_cost / max(uplift, 1)
        return {
            "capacidad_nueva_bidones":      new_cap,
            "revenue_potencial_maximo":     round(max_rev),
            "uplift_revenue_si_ocupas_todo":round(uplift),
            "costo_fijo_adicional_mes":     fix_cost,
            "utilidad_proyectada_maximo":   round(new_util),
            "payback_meses":                round(payback, 1),
            "interpretacion": (
                f"Nueva capacidad {new_cap} bidones: revenue máximo ${max_rev:,.0f}/mes. "
                f"Necesitas {ceil(payback)} meses para recuperar la inversión mensual adicional."
            ),
        }

    return {"error": f"Acción '{action}' no reconocida."}


# ─── Generador de mensajes de campaña ─────────────────────────────────────────
def draft_campaign_message(
    segment: str,
    offer: str,
    client_name: str = None,
    days_inactive: int = None,
) -> dict:
    template = _WA_TEMPLATES.get(segment, _WA_TEMPLATES["en_riesgo"])
    nombre   = client_name or "[nombre]"
    days_str = str(days_inactive) if days_inactive else "un tiempo"
    msg      = template.format(nombre=nombre, offer=offer, days=days_str)
    return {
        "mensaje":      msg,
        "segmento":     segment,
        "is_campaign":  True,
        "instrucciones": (
            f"Envía este mensaje por WhatsApp a cada cliente del segmento '{segment}'. "
            "Reemplaza [nombre] con el nombre real de cada persona antes de enviar."
        ),
    }


# ─── Análisis estratégico de campaña ─────────────────────────────────────────
def analyze_campaign(
    segment: str,
    tipo_campana: str,
    oferta: str,
    rfm_data: dict,
) -> dict:
    """Análisis estratégico completo: segmento, costo, ROI y mensaje WA."""
    total_clientes = rfm_data.get("total_clientes", 0)

    seg_data = next(
        (s for s in rfm_data.get("resumen_segmentos", []) if s["segmento"] == segment),
        None,
    )
    n_clientes = seg_data["cantidad"] if seg_data else 0
    if segment == "todos":
        n_clientes = total_clientes

    revenue_en_riesgo = rfm_data.get("revenue_en_riesgo", 0)
    clientes_riesgo   = rfm_data.get("clientes_en_riesgo_count", 1)
    avg_rev_cliente   = revenue_en_riesgo / max(clientes_riesgo, 1)

    # Costo por cliente según oferta
    costo_por_cliente = 2000
    if "%" in (oferta or ""):
        try:
            pct = float(re.search(r"(\d+)", oferta or "10").group(1)) / 100
            costo_por_cliente = round(avg_rev_cliente * pct / 12)
        except Exception:
            costo_por_cliente = 2000
    elif any(w in (oferta or "").lower() for w in ["bidón", "bidon"]):
        costo_por_cliente = PRECIO_BIDON

    costo_total  = n_clientes * costo_por_cliente
    tasa_exito   = {"reactivacion": 0.25, "retencion": 0.60, "vip_upgrade": 0.30,
                    "nuevo_cliente": 0.40, "volumen": 0.50}.get(tipo_campana, 0.30)
    cli_ganados  = round(n_clientes * tasa_exito)
    rev_rec      = cli_ganados * (avg_rev_cliente / 12)
    roi          = rev_rec / max(costo_total, 1)

    oferta_final = oferta or ("1 bidón gratis al comprar 4" if tipo_campana == "vip_upgrade"
                              else "10% en tu próximo pedido")
    msg_data = draft_campaign_message(
        segment=segment if segment != "todos" else "en_riesgo",
        offer=oferta_final,
    )

    return {
        "segmento":                   segment,
        "tipo_campana":               tipo_campana,
        "n_clientes_objetivo":        n_clientes,
        "clientes_ganados_estimados": cli_ganados,
        "tasa_exito_estimada_pct":    round(tasa_exito * 100),
        "costo_por_cliente_clp":      costo_por_cliente,
        "costo_total_campana_clp":    costo_total,
        "revenue_recuperado_mes":     round(rev_rec),
        "roi_estimado":               round(roi, 1),
        "payback_meses":              round(costo_total / max(rev_rec, 1), 1),
        "oferta_recomendada":         oferta_final,
        "mensaje_whatsapp":           msg_data["mensaje"],
        "is_campaign":                True,
        "interpretacion": (
            f"Campaña '{tipo_campana}' para {n_clientes} clientes '{segment}': "
            f"costo ${costo_total:,.0f} CLP · "
            f"revenue recuperado ~${rev_rec:,.0f}/mes · ROI {roi:.1f}x."
        ),
    }


# ─── Análisis de expansión y canal mayorista ──────────────────────────────────
def recommend_expansion(
    tipo: str,
    volumen_mensual_objetivo: int,
    context_data: dict,
) -> dict:
    """Oportunidades de expansión: mayorista B2B, nueva zona, capacidad."""
    resultados  = {}
    ticket      = context_data.get("ticket_promedio", PRECIO_BIDON)
    cur_bidones = context_data.get("total_bidones_mes", 500)
    cur_rev     = context_data.get("ventas_mensuales", 0)
    costos      = context_data.get("costos_operativos", 0)
    cap_libre   = CAPACITY_MAX - cur_bidones

    if tipo in ("mayorista", "all"):
        vol          = volumen_mensual_objetivo or 40
        precio_may   = round(PRECIO_BIDON * 0.85)   # 15% descuento retail
        rev_mes      = vol * precio_may
        costo_unit   = round(costos / max(cur_bidones, 1))
        margen_unit  = precio_may - costo_unit
        margen_pct   = round((margen_unit / max(precio_may, 1)) * 100)
        resultados["mayorista"] = {
            "volumen_bidones_mes":        vol,
            "precio_mayorista_bidon_clp": precio_may,
            "descuento_vs_retail_pct":    15,
            "revenue_mensual_canal":      rev_mes,
            "margen_unitario_clp":        margen_unit,
            "margen_pct":                 margen_pct,
            "viaje_dedicado_viable":      vol >= 20,
            "clientes_tipo_objetivo":     ["restaurantes", "colegios", "oficinas", "gimnasios", "tiendas barrio"],
            "interpretacion": (
                f"Mayorista {vol} bidones/mes a ${precio_may}/bidón → "
                f"${rev_mes:,.0f} CLP/mes · margen {margen_pct}%. "
                f"{'Ruta dedicada recomendada.' if vol >= 20 else 'Se puede integrar a rutas existentes.'}"
            ),
        }

    if tipo in ("nueva_zona", "all"):
        dist_km  = 15
        orders   = volumen_mensual_objetivo or 50
        rev_mes  = orders * ticket
        fuel_c   = (dist_km * 2) * (orders / 8) * FUEL_COST_PER_KM
        utilidad = rev_mes - fuel_c
        min_ord  = ceil(fuel_c / ticket)
        resultados["nueva_zona"] = {
            "zona_ejemplo":             "San Bernardo",
            "distancia_km":             dist_km,
            "pedidos_objetivo_mes":     orders,
            "revenue_proyectado_mes":   round(rev_mes),
            "costo_combustible_mes":    round(fuel_c),
            "utilidad_neta_mes":        round(utilidad),
            "pedidos_minimos_breakeven":min_ord,
            "viable":                   utilidad > 0,
            "interpretacion": (
                f"San Bernardo (~{dist_km}km): {orders} pedidos/mes → "
                f"utilidad neta ${utilidad:,.0f}/mes. "
                f"Mínimo {min_ord} pedidos para cubrir combustible."
            ),
        }

    if tipo in ("capacidad", "all"):
        cap_pct  = round((cur_bidones / CAPACITY_MAX) * 100)
        rev_max  = CAPACITY_MAX * ticket
        uplift   = rev_max - cur_rev
        resultados["capacidad"] = {
            "capacidad_utilizada_pct":   cap_pct,
            "bidones_libres_mes":        cap_libre,
            "revenue_si_llenas_100pct":  round(rev_max),
            "uplift_potencial_clp":      round(uplift),
            "recomendacion": (
                "Aumentar canal B2C/B2B antes de invertir en más capacidad física"
                if cap_pct < 70
                else "Capacidad casi llena — evaluar expansión física del local"
            ),
        }

    return {
        **resultados,
        "resumen": (
            f"Capacidad actual {round((cur_bidones/max(CAPACITY_MAX,1))*100)}% "
            f"({cap_libre} bidones/mes libres). "
            f"Potencial sin explotar: ${round(cap_libre * ticket):,.0f} CLP/mes."
        ),
    }


# ─── Dispatcher de tools ──────────────────────────────────────────────────────
def _execute_tool(
    name: str,
    args: dict,
    pedidos_cache: list,
    context_data: dict,
) -> dict:
    """Ejecuta la tool solicitada y retorna el resultado como dict."""
    try:
        if name == "get_kpis":
            return {
                "ventas_mensuales":       context_data.get("ventas_mensuales", 0),
                "ventas_mes_pasado":      context_data.get("ventas_mes_pasado", 0),
                "crecimiento_ventas_pct": context_data.get("crecimiento_ventas_pct", 0),
                "pedidos_mensuales":      context_data.get("pedidos_mensuales", 0),
                "crecimiento_pedidos_pct":context_data.get("crecimiento_pedidos_pct", 0),
                "ticket_promedio":        context_data.get("ticket_promedio", 0),
                "utilidad_neta":          context_data.get("utilidad_neta", 0),
                "costos_operativos":      context_data.get("costos_operativos", 0),
                "iva":                    context_data.get("iva", 0),
                "punto_equilibrio":       context_data.get("punto_equilibrio", 0),
                "capacidad_utilizada_pct":context_data.get("capacidad_utilizada_pct", 0),
                "total_bidones_mes":      context_data.get("total_bidones_mes", 0),
                "capacidad_maxima":       CAPACITY_MAX,
                "bidones_disponibles":    CAPACITY_MAX - context_data.get("total_bidones_mes", 0),
            }

        if name == "get_zone_analysis":
            from services.zone_engine import analizar_zonas
            zone_filter = args.get("zone", "todas")
            result = analizar_zonas(pedidos_cache or [])
            if zone_filter != "todas":
                result["zonas"] = [z for z in result.get("zonas", []) if z["zona"] == zone_filter]
            # Añadir confidence flags
            for z in result.get("zonas", []):
                if z.get("pedidos_30d", 0) < 10:
                    z["confidence"] = "low"
                    z["confidence_note"] = (
                        f"Solo {z['pedidos_30d']} pedidos en 30 días — "
                        "muestra pequeña, baja confianza estadística."
                    )
                else:
                    z["confidence"] = "high"
            return result

        if name == "get_customer_segments":
            from services.rfm_engine import calcular_rfm
            segment_filter = args.get("segment", "todos")
            result = calcular_rfm(pedidos_cache or [])
            if segment_filter != "todos":
                result["clientes_en_riesgo"] = [
                    c for c in result.get("clientes_en_riesgo", [])
                    if c.get("segmento") == segment_filter
                ]
                result["clientes_campeon"] = [
                    c for c in result.get("clientes_campeon", [])
                    if c.get("segmento", "campeon") == segment_filter
                ]
            return result

        if name == "get_trends":
            from services.memory_service import obtener_contexto_historico
            days = min(int(args.get("days", 30)), 90)
            return obtener_contexto_historico(dias=days)

        if name == "get_daily_cashflow":
            try:
                from main import get_ventas_diarias
                return get_ventas_diarias()
            except Exception as e:
                logger.error(f"Error en get_daily_cashflow: {e}")
                return {"error": "No se pudo obtener ventas diarias"}

        if name == "get_inventory":
            try:
                from main import get_estado_inventario
                return get_estado_inventario()
            except Exception as e:
                logger.error(f"Error en get_inventory: {e}")
                return {"error": "Inventario no disponible"}

        if name == "simulate_scenario":
            scenario_context = {**context_data, "pedidos_cache": pedidos_cache}
            return simulate_scenario(args["action"], args.get("params", {}), scenario_context)

        if name == "draft_campaign_message":
            return draft_campaign_message(
                segment=args.get("segment", "en_riesgo"),
                offer=args.get("offer", ""),
                client_name=args.get("client_name"),
                days_inactive=args.get("days_inactive"),
            )

        if name == "analyze_campaign":
            from services.rfm_engine import calcular_rfm
            rfm = calcular_rfm(pedidos_cache or [])
            return analyze_campaign(
                segment=args.get("segment", "en_riesgo"),
                tipo_campana=args.get("tipo_campana", "reactivacion"),
                oferta=args.get("oferta", ""),
                rfm_data=rfm,
            )

        if name == "recommend_expansion":
            return recommend_expansion(
                tipo=args.get("tipo", "all"),
                volumen_mensual_objetivo=int(args.get("volumen_mensual_objetivo", 40)),
                context_data=context_data,
            )

        if name == "get_customer_risk":
            from services.customer_risk_service import calcular_riesgo_clientes
            return calcular_riesgo_clientes(pedidos_cache or [])

        if name == "get_demand_forecast":
            from services.demand_forecast_service import predecir_proximos_dias, validar_precision
            dias = min(int(args.get("dias", 7)), 30)
            pronostico = predecir_proximos_dias(pedidos_cache or [], dias=dias)
            precision = validar_precision(pedidos_cache or [], dias_test=30)
            return {"pronostico": pronostico, "precision_historica": precision}

        if name == "get_rentabilidad_reportes":
            try:
                from main import get_analisis_rentabilidad, get_reporte_ejecutivo
                return {
                    "rentabilidad": get_analisis_rentabilidad(),
                    "reporte_ejecutivo": get_reporte_ejecutivo(),
                }
            except Exception as e:
                logger.error(f"Error en get_rentabilidad_reportes: {e}")
                return {"error": "No se pudo obtener el análisis de rentabilidad"}

        if name == "get_discount_analysis":
            from services.discount_analysis_service import analizar_descuento_volumen
            return analizar_descuento_volumen(pedidos_cache or [])

        if name == "get_route_intelligence":
            from services.route_intelligence_service import analizar_densidad_geografica
            return analizar_densidad_geografica(pedidos_cache or [])

        if name == "get_growth_opportunities":
            from services.opportunity_service import detectar_oportunidades_crecimiento
            return detectar_oportunidades_crecimiento(pedidos_cache or [])

        if name == "get_margin_leak_analysis":
            from services.margin_leak_service import detectar_fuga_margen
            from services.zone_engine import analizar_zonas
            from services.fuel_service import obtener_precio_bencina
            from services.business_context import DISTANCIAS_KM
            # analizar_zonas() no incluye distancia_km en su salida (ese campo lo
            # calcula business_context.py a partir de DISTANCIAS_KM) — se adapta
            # aquí antes de pasarlo a detectar_fuga_margen, que sí lo requiere.
            zonas_raw = analizar_zonas(pedidos_cache or [])
            zonas_data = {
                "zonas": [
                    {**z, "distancia_km": DISTANCIAS_KM.get(z.get("zona"))}
                    for z in zonas_raw.get("zonas", [])
                ]
            }
            precio_combustible = obtener_precio_bencina().get("precio_litro", 1200)
            return detectar_fuga_margen(zonas_data, precio_combustible_litro=precio_combustible)

        if name == "get_payment_risk_analysis":
            from services.payment_risk_service import analizar_riesgo_pago
            return analizar_riesgo_pago(pedidos_cache or [])

        return {"error": f"Tool desconocida: {name}"}

    except Exception as e:
        logger.error(f"Error ejecutando tool '{name}': {e}")
        return {"error": str(e)}


# ─── run_chat_query — loop de function calling ────────────────────────────────
def run_chat_query(
    context_data: dict,
    question: str,
    history: list = None,
    pedidos_cache: list = None,
) -> Union[str, dict]:
    """Chat con function calling. Retorna respuesta markdown como string.

    En caso de fallo de OpenAI (rate limit, timeout, etc.) retorna en su lugar
    un dict estructurado `{"error": True, "mensaje": "..."}` con un mensaje
    genérico y seguro para mostrar al usuario, en vez de la excepción cruda.

    Delgado (thin wrapper) sobre `run_chat_query_with_rec_id` — preserva el
    contrato histórico de esta función (Task 2) de retornar solo `str | dict`,
    descartando el `rec_id`. Los llamadores que necesiten el `rec_id` (p.ej.
    `main.py` en `/chat`) deben usar `run_chat_query_with_rec_id` directamente.
    """
    respuesta, _rec_id = run_chat_query_with_rec_id(
        context_data, question, history=history, pedidos_cache=pedidos_cache
    )
    return respuesta


def run_chat_query_with_rec_id(
    context_data: dict,
    question: str,
    history: list = None,
    pedidos_cache: list = None,
) -> tuple:
    """Igual que `run_chat_query`, pero retorna una tupla `(respuesta, rec_id)`.

    `rec_id` es el id entero de la última recomendación persistida por
    `memory_service.guardar_recomendacion` durante esta consulta (generada por
    `draft_campaign_message` o `simulate_scenario`), o `None` si no se generó
    ninguna recomendación (incluye el caso de respuesta desde caché, donde no
    se vuelve a ejecutar ninguna tool).
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "El Agente no está configurado (API Key faltante).", None

    client   = OpenAI(api_key=api_key)
    core_ctx = _build_core_context(context_data)

    # Caché
    _invalidate_cache_if_needed(core_ctx)
    cache_key = _make_cache_key(question, core_ctx)
    if cache_key in CHAT_CACHE:
        logger.info("Respuesta desde caché.")
        return CHAT_CACHE[cache_key], None

    # Seleccionar tools según intento
    intent = _classify_intent(question)
    tools  = _get_tools_for_intent(intent)

    # Construir conversación
    system_msg = {
        "role": "system",
        "content": f"{CHAT_PROMPT}\n\nCONTEXTO ACTUAL DEL NEGOCIO:\n{json.dumps(core_ctx, ensure_ascii=False)}",
    }
    conversation = [system_msg]
    if history:
        for msg in history[-12:]:
            role = "assistant" if msg.get("role") == "agent" else "user"
            conversation.append({"role": role, "content": msg.get("content", "")})
    conversation.append({"role": "user", "content": question})

    # Guardia de tokens
    conversation = _compress_if_needed(conversation, client)

    tools_used: list = []
    used_no_cache_tool = False
    rec_id = None

    for _ in range(5):
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=conversation,
                tools=tools,
                tool_choice="auto",
                temperature=0.25,
                max_tokens=1200,
            )
        except Exception as e:
            logger.error(f"Error OpenAI en chat: {e}")
            return {"error": True, "mensaje": "No pude conectarme con el servicio de análisis. Intenta de nuevo en un momento."}, None

        choice = response.choices[0]

        if choice.finish_reason == "stop":
            answer = choice.message.content or ""
            if not used_no_cache_tool:
                CHAT_CACHE[cache_key] = answer
            return answer, rec_id

        if choice.finish_reason == "tool_calls":
            # Añadir mensaje del asistente con tool_calls
            conversation.append({
                "role": "assistant",
                "content": choice.message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                    for tc in choice.message.tool_calls
                ],
            })

            # Ejecutar cada tool y añadir resultado
            for tc in choice.message.tool_calls:
                name = tc.function.name
                try:
                    tool_args = json.loads(tc.function.arguments)
                except Exception:
                    tool_args = {}

                tools_used.append(name)
                if name in NO_CACHE_TOOLS:
                    used_no_cache_tool = True

                result = _execute_tool(name, tool_args, pedidos_cache, context_data)

                # Guardar recomendación si aplica
                if name in ("draft_campaign_message", "simulate_scenario"):
                    try:
                        from services.memory_service import guardar_recomendacion
                        nuevo_id = guardar_recomendacion({
                            "tipo": name,
                            "zona": tool_args.get("segment", tool_args.get("action", "general")),
                            "descripcion": json.dumps(result, ensure_ascii=False)[:400],
                        })
                        if isinstance(nuevo_id, int) and nuevo_id > 0:
                            rec_id = nuevo_id
                    except Exception:
                        pass

                conversation.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })

    return "No se pudo completar el análisis en el tiempo límite.", rec_id


# ─── run_chat_query_prepare — para streaming (sin llamada final) ──────────────
def run_chat_query_prepare(
    context_data: dict,
    question: str,
    history: list = None,
    pedidos_cache: list = None,
) -> tuple:
    """
    Ejecuta el loop de tools silenciosamente.
    Retorna (conversation_lista, tools_used_lista, rec_id) listos para la llamada
    final con stream=True. `rec_id` es el id entero de la última recomendación
    persistida por `memory_service.guardar_recomendacion` durante esta consulta
    (generada por `draft_campaign_message` o `simulate_scenario`), o `None` si
    no se generó ninguna.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return [], [], None

    client   = OpenAI(api_key=api_key)
    core_ctx = _build_core_context(context_data)
    intent   = _classify_intent(question)
    tools    = _get_tools_for_intent(intent)

    system_msg = {
        "role": "system",
        "content": f"{CHAT_PROMPT}\n\nCONTEXTO ACTUAL DEL NEGOCIO:\n{json.dumps(core_ctx, ensure_ascii=False)}",
    }
    conversation = [system_msg]
    if history:
        for msg in history[-12:]:
            role = "assistant" if msg.get("role") == "agent" else "user"
            conversation.append({"role": role, "content": msg.get("content", "")})
    conversation.append({"role": "user", "content": question})
    conversation = _compress_if_needed(conversation, client)

    tools_used: list = []
    rec_id = None

    for _ in range(5):
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=conversation,
                tools=tools,
                tool_choice="auto",
                temperature=0.25,
                max_tokens=1200,
            )
        except Exception as e:
            logger.error(f"Error prepare: {e}")
            return conversation, tools_used, rec_id

        choice = response.choices[0]

        if choice.finish_reason == "stop":
            # La conversación está lista para ser re-llamada con stream=True
            return conversation, tools_used, rec_id

        if choice.finish_reason == "tool_calls":
            conversation.append({
                "role": "assistant",
                "content": choice.message.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in choice.message.tool_calls
                ],
            })

            for tc in choice.message.tool_calls:
                name = tc.function.name
                try:
                    tool_args = json.loads(tc.function.arguments)
                except Exception:
                    tool_args = {}

                tools_used.append(name)
                result = _execute_tool(name, tool_args, pedidos_cache, context_data)

                if name in ("draft_campaign_message", "simulate_scenario"):
                    try:
                        from services.memory_service import guardar_recomendacion
                        nuevo_id = guardar_recomendacion({
                            "tipo": name,
                            "zona": tool_args.get("segment", tool_args.get("action", "general")),
                            "descripcion": json.dumps(result, ensure_ascii=False)[:400],
                        })
                        if isinstance(nuevo_id, int) and nuevo_id > 0:
                            rec_id = nuevo_id
                    except Exception:
                        pass

                conversation.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result, ensure_ascii=False),
                })

    return conversation, tools_used, rec_id


# ─── run_autonomous_insight — loop de background (sin cambios) ────────────────
def run_autonomous_insight(context_data: dict) -> list:
    """Ejecuta el job en background para extraer insights CEO con todos los datos."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        logger.error("Sin API Key para motor AI")
        return []

    client = OpenAI(api_key=api_key)

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"REPORTE COMPLETO DEL NEGOCIO:\n"
                        f"{json.dumps(context_data, indent=2, ensure_ascii=False)}\n\n"
                        "Genera los insights ejecutivos en formato JSON."
                    ),
                },
            ],
            temperature=0.2,
            max_tokens=600,
        )

        raw = response.choices[0].message.content.strip()
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]

        return json.loads(raw.strip())

    except Exception as e:
        logger.error(f"Error generando insights autónomos: {e}")
        return []
