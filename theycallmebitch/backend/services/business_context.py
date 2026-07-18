import logging
from typing import Dict, List

logger = logging.getLogger(__name__)

# Distancias aproximadas desde el local (Lago La Paloma 4565, Villa El Alba, Puente Alto)
# hasta cada zona de reparto activa.
DISTANCIAS_KM = {
    "puente_alto":  2,
    "la_florida":   8,
    "macul":        12,
    "otras":        None,
    "sin_direccion": None,
}


def build_business_context(kpis: dict, rfm: dict = None, zonas: dict = None, clima: dict = None, memoria: dict = None) -> dict:
    """
    Agrega la realidad completa del negocio.
    Recibe KPIs base + análisis RFM + zonas + clima + memoria histórica.
    Estructura el contexto que el CEO virtual necesita para operar.
    """

    # === KPIs Base ===
    ventas_mensuales = kpis.get("ventas_mes", 0)
    ventas_pasado = kpis.get("ventas_mes_pasado", 0)
    pedidos_mensuales = kpis.get("total_pedidos_mes", 0)
    pedidos_pasados = kpis.get("total_pedidos_mes_pasado", 0)
    cap_utilizada = kpis.get("capacidad_utilizada", 0)

    try:
        growth_ventas = round(((ventas_mensuales - ventas_pasado) / ventas_pasado * 100), 1) if ventas_pasado > 0 else 0
    except Exception:
        growth_ventas = 0

    try:
        ticket_prom = int(ventas_mensuales / pedidos_mensuales) if pedidos_mensuales > 0 else 0
    except Exception:
        ticket_prom = 0

    try:
        growth_pedidos = round(((pedidos_mensuales - pedidos_pasados) / pedidos_pasados * 100), 1) if pedidos_pasados > 0 else 0
    except Exception:
        growth_pedidos = 0

    # === RFM ===
    rfm = rfm or {}
    total_clientes = rfm.get("total_clientes", kpis.get("clientes_activos", 0))
    clientes_en_riesgo_count = rfm.get("clientes_en_riesgo_count", 0)
    revenue_en_riesgo = rfm.get("revenue_en_riesgo", 0)
    clientes_perdidos_count = rfm.get("clientes_perdidos_count", 0)
    revenue_perdido_historico = rfm.get("revenue_perdido_historico", 0)
    ticket_promedio_global = rfm.get("ticket_promedio_global", ticket_prom)
    resumen_segmentos = rfm.get("resumen_segmentos", [])
    clientes_en_riesgo = rfm.get("clientes_en_riesgo", [])
    clientes_campeon = rfm.get("clientes_campeon", [])

    # === Zonas ===
    zonas = zonas or {}
    zona_lider = zonas.get("zona_lider", "N/A")
    zona_lider_revenue_30d = zonas.get("zona_lider_revenue_30d", 0)
    oportunidades_reactivacion = zonas.get("oportunidades_reactivacion", [])
    alertas_caida_zonas = zonas.get("alertas_caida", [])
    total_zonas_activas = zonas.get("total_zonas_activas", 0)
    total_zonas_dormidas = zonas.get("total_zonas_dormidas", 0)
    lista_zonas = zonas.get("zonas", [])

    # Construir resumen ejecutivo de zonas (limitar tamaño en el prompt)
    zonas_resumen = [
        {
            "zona": z["zona"],
            "estado": z["estado"],
            "pedidos_30d": z["pedidos_30d"],
            "revenue_30d": z["revenue_30d"],
            "tendencia_pct": z["tendencia_pct"],
        }
        for z in lista_zonas
    ]

    # === Clima ===
    clima = clima or {}
    temp_actual = clima.get("temp_actual", None)
    descripcion_clima = clima.get("descripcion", "sin datos")
    lluvia_hoy_mm = clima.get("lluvia_hoy_mm", 0)
    multiplicador_demanda_hoy = clima.get("multiplicador_demanda_hoy", 1.0)
    impacto_demanda_pct = clima.get("impacto_demanda_pct", 0)
    forecast_5_dias = clima.get("forecast_5_dias", [])

    # === Memoria Histórica ===
    memoria = memoria or {}
    insights_recientes = memoria.get("insights_recientes", [])
    snapshots_kpis = memoria.get("snapshots_kpis", [])
    briefing_hoy = memoria.get("briefing_hoy", None)

    # Calcular tendencia de ventas últimas semanas desde snapshots
    tendencia_historica = []
    if snapshots_kpis:
        for snap in snapshots_kpis[:7]:  # Últimos 7 días
            tendencia_historica.append({
                "fecha": snap.get("fecha"),
                "ventas": snap.get("ventas_mes"),
                "pedidos": snap.get("pedidos_mes"),
            })

    # Calcular eficiencia de ruta (revenue_30d / distancia_km) por zona
    zonas_eficiencia = []
    for z in zonas_resumen:
        dist = DISTANCIAS_KM.get(z["zona"])
        rev30 = z.get("revenue_30d", 0)
        ped30 = z.get("pedidos_30d", 0)
        eficiencia = round(rev30 / dist, 0) if dist and dist > 0 and rev30 > 0 else None
        zonas_eficiencia.append({
            "zona": z["zona"],
            "distancia_km": dist,
            "revenue_30d": rev30,
            "pedidos_30d": ped30,
            "revenue_por_km": eficiencia,   # CLP por km — indica si vale la ruta
            "tendencia_pct": z.get("tendencia_pct", 0),
            "estado": z.get("estado", ""),
        })

    return {
        # --- Ventas y crecimiento ---
        "ventas_mensuales": ventas_mensuales,
        "ventas_mes_pasado": ventas_pasado,
        "crecimiento_ventas_pct": growth_ventas,
        "pedidos_mensuales": pedidos_mensuales,
        "pedidos_mes_pasado": pedidos_pasados,
        "crecimiento_pedidos_pct": growth_pedidos,
        "ticket_promedio": ticket_prom,
        "ticket_promedio_global_rfm": ticket_promedio_global,
        "utilidad_neta": kpis.get("utilidad", 0),
        "costos_operativos": kpis.get("costos_reales", 0),
        "iva": kpis.get("iva", 0),
        "punto_equilibrio": kpis.get("punto_equilibrio", 0),

        # --- Capacidad ---
        "capacidad_utilizada_pct": round(cap_utilizada, 1),
        "capacidad_maxima_litros": 30000,
        "total_bidones_mes": kpis.get("total_bidones_mes", 0),

        # --- Clientes (base) ---
        "clientes_activos": kpis.get("clientes_activos", 0),
        "clientes_inactivos": kpis.get("clientes_inactivos", 0),

        # --- RFM ---
        "total_clientes_rfm": total_clientes,
        "clientes_en_riesgo_count": clientes_en_riesgo_count,
        "revenue_en_riesgo": revenue_en_riesgo,
        "clientes_perdidos_count": clientes_perdidos_count,
        "revenue_perdido_historico": revenue_perdido_historico,
        "segmentos_rfm": resumen_segmentos,
        "top_clientes_en_riesgo": clientes_en_riesgo[:5],  # Solo top 5 para no saturar el prompt
        "top_clientes_campeon": clientes_campeon[:5],

        # --- Zonas geográficas ---
        "zona_lider": zona_lider,
        "zona_lider_revenue_30d": zona_lider_revenue_30d,
        "zonas_activas": total_zonas_activas,
        "zonas_dormidas": total_zonas_dormidas,
        "zonas_eficiencia_ruta": zonas_eficiencia,   # revenue/km por zona — base para decisión de despacho
        "oportunidades_reactivacion_zonas": oportunidades_reactivacion[:3],
        "alertas_caida_zonas": alertas_caida_zonas,

        # --- Clima ---
        "clima": {
            "temp_actual": temp_actual,
            "descripcion": descripcion_clima,
            "lluvia_hoy_mm": lluvia_hoy_mm,
            "multiplicador_demanda_hoy": multiplicador_demanda_hoy,
            "impacto_demanda_pct": impacto_demanda_pct,
            "forecast_proximos_dias": forecast_5_dias[:3],
        },

        # --- Memoria histórica ---
        "insights_anteriores": [
            {"tipo": i.get("tipo"), "mensaje": i.get("mensaje"), "fecha": i.get("timestamp", "")[:10]}
            for i in insights_recientes[:3]
        ],
        "tendencia_ventas_7d": tendencia_historica,
    }
