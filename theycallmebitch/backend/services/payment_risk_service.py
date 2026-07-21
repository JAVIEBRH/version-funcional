"""
Servicio de riesgo de cobranza por método de pago.

Calcula la tasa real de cancelación/fallo por método de pago — dato que
hoy no se cruza en ningún KPI ni módulo del dashboard.
"""
import logging
from typing import Dict, List

import pandas as pd

logger = logging.getLogger(__name__)

ESTADOS_FALLIDOS = {'cancelado', 'fallido', 'rechazado'}


def analizar_riesgo_pago(pedidos: List[Dict]) -> Dict:
    df = pd.DataFrame(pedidos)
    if df.empty:
        return {"metodos": []}
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if df.empty or 'metodopago' not in df.columns:
        return {"metodos": []}

    df['metodo_norm'] = df['metodopago'].astype(str).str.strip().str.lower()
    df = df[df['metodo_norm'] != '']

    if 'status' in df.columns:
        estado_series = df['status'].astype(str).str.strip().str.lower()
    else:
        estado_series = pd.Series('', index=df.index)
    df['es_fallido'] = estado_series.isin(ESTADOS_FALLIDOS)

    resultado = []
    for metodo, grupo in df.groupby('metodo_norm'):
        total = len(grupo)
        fallidos = int(grupo['es_fallido'].sum())
        resultado.append({
            "metodo": metodo,
            "total_pedidos": total,
            "pedidos_fallidos": fallidos,
            "tasa_cancelacion_pct": round((fallidos / total) * 100, 1) if total > 0 else 0,
        })

    resultado.sort(key=lambda m: -m['tasa_cancelacion_pct'])
    return {"metodos": resultado}
