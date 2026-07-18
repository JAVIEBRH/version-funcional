"""
Servicio de Briefing Diario
Genera el reporte ejecutivo del día usando todos los datos disponibles.
"""
import os
import json
import logging
from datetime import datetime
from openai import OpenAI
from typing import Dict

logger = logging.getLogger(__name__)

BRIEFING_PROMPT = """Eres el CEO/COO virtual de Aguas Ancud (Chiloé, Chile).
Empresa de agua purificada en bidones de 20L.

Con los datos del reporte diario que te entrego, genera un BRIEFING EJECUTIVO MATUTINO.

ESTRUCTURA OBLIGATORIA (usa exactamente estos encabezados en markdown):
## Estado General
1-2 líneas: semáforo del negocio hoy (🟢 bien / 🟡 atención / 🔴 crítico) y por qué.

## Alertas Críticas
- Lista las alertas que requieren acción HOY (máx 3). Si no hay, escribe "Sin alertas críticas."

## Oportunidades del Día
- Lista las oportunidades concretas para actuar hoy (máx 3).

## Clientes en Riesgo
- Menciona cuántos clientes están en riesgo de fuga y el revenue comprometido.

## Zona Prioritaria
- Una zona geográfica a atender hoy con acción específica.

## Clima y Demanda
- Cómo el clima de hoy afecta la demanda esperada (usa el multiplicador).

REGLAS:
- Números concretos siempre (pesos, porcentajes, cantidad de clientes).
- Máximo 250 palabras total.
- No uses frases genéricas. Todo basado en los datos provistos.
"""


def generar_briefing(context: Dict) -> str:
    """Genera el briefing ejecutivo del día con IA."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return _briefing_sin_ia(context)

    client = OpenAI(api_key=api_key)
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": BRIEFING_PROMPT},
                {"role": "user", "content": f"DATOS DEL DÍA:\n{json.dumps(context, indent=2, ensure_ascii=False)}"}
            ],
            temperature=0.3,
            max_tokens=500
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Error generando briefing con IA: {e}")
        return _briefing_sin_ia(context)


def _briefing_sin_ia(context: Dict) -> str:
    """Briefing de respaldo sin IA (solo con datos estructurados)."""
    ventas = context.get("ventas_mensuales", 0)
    pedidos = context.get("pedidos_mensuales", 0)
    clientes_riesgo = context.get("clientes_en_riesgo_count", 0)
    revenue_riesgo = context.get("revenue_en_riesgo", 0)
    zona_lider = context.get("zona_lider", "N/A")
    temp = context.get("clima", {}).get("temp_actual", "?")
    mult = context.get("clima", {}).get("multiplicador_demanda_hoy", 1.0)
    impacto = context.get("clima", {}).get("impacto_demanda_pct", 0)

    signo = "+" if impacto >= 0 else ""
    fecha = datetime.now().strftime("%d/%m/%Y")

    return f"""## Briefing Ejecutivo — {fecha}

## Estado General
Ventas del mes: ${ventas:,} | Pedidos: {pedidos} | Zona líder: {zona_lider}

## Alertas Críticas
- {clientes_riesgo} clientes en riesgo de fuga (revenue comprometido: ${revenue_riesgo:,})

## Clima y Demanda
Temperatura actual: {temp}°C — impacto demanda: {signo}{impacto}% (multiplicador: {mult}x)
"""
