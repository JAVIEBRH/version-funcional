"""
Servicio de activación de clientes nuevos.

Distinto de churn (que mide clientes existentes que se van): mide, de los
clientes cuya PRIMERA compra fue hace suficiente tiempo como para haber
podido volver, qué porcentaje realmente hizo una segunda compra dentro de
la ventana — diagnóstico de conversión del primer pedido.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _parsear_fecha(fecha_str):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def calcular_tasa_activacion(pedidos: List[Dict], ventana_dias: int = 30) -> Dict:
    df = pd.DataFrame(pedidos)
    if df.empty:
        return {"clientes_evaluados": 0, "clientes_activados": 0, "tasa_activacion_pct": None, "dias_promedio_segunda_compra": None}
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if df.empty or 'usuario' not in df.columns:
        return {"clientes_evaluados": 0, "clientes_activados": 0, "tasa_activacion_pct": None, "dias_promedio_segunda_compra": None}

    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])

    hoy = datetime.now()
    corte_elegible = hoy - timedelta(days=ventana_dias)

    evaluados = 0
    activados = 0
    dias_hasta_segunda = []

    for usuario, grupo in df.groupby('usuario'):
        fechas = sorted(grupo['fecha_dt'].tolist())
        primera_compra = fechas[0]
        if primera_compra > corte_elegible:
            continue  # no le ha dado tiempo de volver todavía

        evaluados += 1
        if len(fechas) >= 2:
            segunda_compra = fechas[1]
            dias = (segunda_compra - primera_compra).days
            if dias <= ventana_dias:
                activados += 1
                dias_hasta_segunda.append(dias)

    if evaluados == 0:
        return {"clientes_evaluados": 0, "clientes_activados": 0, "tasa_activacion_pct": None, "dias_promedio_segunda_compra": None}

    return {
        "clientes_evaluados": evaluados,
        "clientes_activados": activados,
        "tasa_activacion_pct": round((activados / evaluados) * 100, 1),
        "dias_promedio_segunda_compra": round(float(np.mean(dias_hasta_segunda)), 1) if dias_hasta_segunda else None,
    }
