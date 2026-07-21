"""
Servicio de detección de anomalías.

Cálculo puro (sin IA) sobre la serie diaria de pedidos: detecta
desviaciones estadísticas reales (no ruido normal) para decidir si vale la
pena generar una alerta. Reutiliza la misma construcción de serie diaria
que `demand_forecast_service.construir_serie_diaria`.
"""
import logging
from typing import Dict, List

import numpy as np

from services.demand_forecast_service import construir_serie_diaria

logger = logging.getLogger(__name__)

MIN_DIAS_HISTORIAL = 14
UMBRAL_DESVIACIONES = 2.0  # desviaciones estándar


def detectar_anomalias(pedidos: List[Dict]) -> List[Dict]:
    serie = construir_serie_diaria(pedidos)
    if len(serie) < MIN_DIAS_HISTORIAL:
        return []

    conteos = serie['pedidos'].values
    historial = conteos[:-1]
    hoy = conteos[-1]

    media = float(np.mean(historial))
    desviacion = float(np.std(historial))
    if desviacion == 0:
        return []

    z_score = (hoy - media) / desviacion
    anomalias = []
    if z_score <= -UMBRAL_DESVIACIONES:
        anomalias.append({
            "tipo": "caida_pedidos",
            "fecha": str(serie['fecha'].iloc[-1]),
            "descripcion": f"Pedidos de hoy ({int(hoy)}) muy por debajo del promedio de los últimos {len(historial)} días ({media:.1f}).",
            "severidad": "alta" if z_score <= -3 else "media",
        })
    elif z_score >= UMBRAL_DESVIACIONES:
        anomalias.append({
            "tipo": "salto_pedidos",
            "fecha": str(serie['fecha'].iloc[-1]),
            "descripcion": f"Pedidos de hoy ({int(hoy)}) muy por encima del promedio de los últimos {len(historial)} días ({media:.1f}).",
            "severidad": "media",
        })
    return anomalias
