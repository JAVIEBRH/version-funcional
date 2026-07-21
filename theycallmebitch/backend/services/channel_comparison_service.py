"""
Servicio de comparación de canales (Local vs Delivery).

Compara los últimos 30 días vs los 30 días anteriores en cada canal, para
responder si un canal compensa una caída del otro, o si ambos caen
juntos — comparación que hoy no existe en ningún módulo.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List

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


def _resumen_canal(df_canal: pd.DataFrame, hoy: datetime) -> Dict:
    corte_30 = hoy - timedelta(days=30)
    corte_60 = hoy - timedelta(days=60)

    df_30d = df_canal[df_canal['fecha_dt'] >= corte_30]
    df_prev = df_canal[(df_canal['fecha_dt'] >= corte_60) & (df_canal['fecha_dt'] < corte_30)]

    revenue_30d = float(df_30d['precio_num'].sum())
    revenue_prev = float(df_prev['precio_num'].sum())
    tendencia_pct = round(((revenue_30d - revenue_prev) / revenue_prev) * 100, 1) if revenue_prev > 0 else None

    return {
        "pedidos_30d": int(len(df_30d)),
        "revenue_30d": round(revenue_30d, 0),
        "revenue_periodo_anterior": round(revenue_prev, 0),
        "tendencia_pct": tendencia_pct,
    }


def comparar_canales(pedidos: List[Dict]) -> Dict:
    vacio = {"pedidos_30d": 0, "revenue_30d": 0, "revenue_periodo_anterior": 0, "tendencia_pct": None}
    df = pd.DataFrame(pedidos)
    if df.empty:
        return {"local": dict(vacio), "delivery": dict(vacio)}

    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if df.empty:
        return {"local": dict(vacio), "delivery": dict(vacio)}

    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])
    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)

    # Handle missing 'retirolocal' column - fix for the missing-column-as-Series bug
    if 'retirolocal' in df.columns:
        retirolocal_series = df['retirolocal'].astype(str).str.strip().str.lower()
    else:
        retirolocal_series = pd.Series('', index=df.index)
    df['es_local'] = retirolocal_series == 'si'

    hoy = datetime.now()
    return {
        "local": _resumen_canal(df[df['es_local']], hoy),
        "delivery": _resumen_canal(df[~df['es_local']], hoy),
    }
