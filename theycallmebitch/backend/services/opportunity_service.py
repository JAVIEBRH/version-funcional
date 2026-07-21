"""
Servicio de detección de oportunidad (crecimiento de clientes).

Espejo de customer_risk_service: en vez de detectar clientes que se
atrasan respecto a su cadencia personal, detecta clientes cuya cadencia
RECIENTE (últimos 60 días) es más corta que su cadencia histórica —
señal real de que están comprando más seguido, no una suposición.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

VENTANA_RECIENTE_DIAS = 60
MIN_PEDIDOS_POR_VENTANA = 2
UMBRAL_CRECIMIENTO_PCT = 0.20  # 20% más rápido


def _parsear_fecha(fecha_str):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def _cadencia(fechas: list) -> float:
    if len(fechas) < 2:
        return None
    fechas = sorted(fechas)
    intervalos = [(fechas[i] - fechas[i - 1]).days for i in range(1, len(fechas))]
    return float(np.mean(intervalos))


def detectar_oportunidades_crecimiento(pedidos: List[Dict]) -> Dict:
    df = pd.DataFrame(pedidos)
    if df.empty:
        return {"clientes": []}
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if df.empty or 'usuario' not in df.columns:
        return {"clientes": []}
    df = df[df['usuario'].astype(str).str.strip() != '']
    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])
    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)

    hoy = datetime.now()
    corte_reciente = hoy - timedelta(days=VENTANA_RECIENTE_DIAS)

    resultado = []
    for usuario, grupo in df.groupby('usuario'):
        fechas = grupo['fecha_dt'].tolist()
        recientes = [f for f in fechas if f >= corte_reciente]
        antiguas = [f for f in fechas if f < corte_reciente]

        if len(recientes) < MIN_PEDIDOS_POR_VENTANA or len(antiguas) < MIN_PEDIDOS_POR_VENTANA:
            continue

        cadencia_reciente = _cadencia(recientes)
        cadencia_anterior = _cadencia(antiguas)
        if not cadencia_reciente or not cadencia_anterior or cadencia_anterior <= 0:
            continue

        crecimiento_pct = (cadencia_anterior - cadencia_reciente) / cadencia_anterior
        if crecimiento_pct >= UMBRAL_CRECIMIENTO_PCT:
            resultado.append({
                "usuario": usuario,
                "cadencia_anterior_dias": round(cadencia_anterior, 1),
                "cadencia_reciente_dias": round(cadencia_reciente, 1),
                "crecimiento_pct": round(crecimiento_pct * 100, 1),
                "gasto_promedio": round(float(grupo['precio_num'].mean()), 0),
            })

    resultado.sort(key=lambda c: -c['gasto_promedio'])
    return {"clientes": resultado}
