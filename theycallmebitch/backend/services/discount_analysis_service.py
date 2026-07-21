"""
Servicio de análisis de descuento por volumen.

Compara, dentro de la misma zona geográfica, pedidos que recibieron un
precio por bidón reducido (paquete/descuento) contra pedidos que pagaron
el precio normal de $2.000/bidón — para estimar si el descuento genera
más frecuencia/retención de la que cuesta en margen. Es la base real de
"elasticidad" de este proyecto: no hay variación histórica del precio
único, pero sí variación real entre pedidos con y sin descuento de
volumen dentro de una misma zona (ej. Portezuelo, Puente Alto).
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional
from collections import defaultdict

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

PRECIO_NORMAL_BIDON = 2000
UMBRAL_DESCUENTO = 1800  # precio/bidón por debajo de esto se considera "con descuento"

ZONAS_CONOCIDAS = {
    "portezuelo": ["portezuelo", "tamarix", "bauble", "baubel", "loma larga"],
}


def _parsear_fecha(fecha_str: Optional[str]):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def _detectar_zona(direccion: str) -> Optional[str]:
    dir_lower = (direccion or '').lower()
    for zona, keywords in ZONAS_CONOCIDAS.items():
        if any(kw in dir_lower for kw in keywords):
            return zona
    return None


def analizar_descuento_volumen(pedidos: List[Dict]) -> Dict:
    df = pd.DataFrame(pedidos)
    if df.empty:
        return {"zonas_con_descuento": []}

    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if df.empty or 'dire' not in df.columns:
        return {"zonas_con_descuento": []}

    df['zona'] = df['dire'].apply(_detectar_zona)
    df = df.dropna(subset=['zona'])
    if df.empty:
        return {"zonas_con_descuento": []}

    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)
    df['bidones'] = pd.to_numeric(df.get('ordenpedido', 0), errors='coerce').fillna(0)
    df = df[df['bidones'] > 0]
    df['precio_por_bidon'] = df['precio_num'] / df['bidones']
    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])

    resultado = []
    for zona, grupo in df.groupby('zona'):
        con_descuento = grupo[grupo['precio_por_bidon'] < UMBRAL_DESCUENTO]
        sin_descuento = grupo[grupo['precio_por_bidon'] >= UMBRAL_DESCUENTO]

        if con_descuento.empty and sin_descuento.empty:
            continue

        def _frecuencia_promedio(sub_df):
            if len(sub_df) < 2:
                return None
            fechas = sorted(sub_df['fecha_dt'].tolist())
            intervalos = [(fechas[i] - fechas[i - 1]).days for i in range(1, len(fechas))]
            return round(float(np.mean(intervalos)), 1) if intervalos else None

        freq_con = _frecuencia_promedio(con_descuento)
        freq_sin = _frecuencia_promedio(sin_descuento)

        elasticidad = None
        if freq_con and freq_sin and freq_sin > 0:
            precio_prom_con = con_descuento['precio_por_bidon'].mean()
            precio_prom_sin = sin_descuento['precio_por_bidon'].mean()
            if precio_prom_sin > 0:
                cambio_frecuencia_pct = (freq_sin - freq_con) / freq_sin
                cambio_precio_pct = (precio_prom_sin - precio_prom_con) / precio_prom_sin
                if cambio_precio_pct != 0:
                    elasticidad = round(cambio_frecuencia_pct / cambio_precio_pct, 2)

        resultado.append({
            "zona_clave": zona,
            "pedidos_con_descuento": int(len(con_descuento)),
            "pedidos_sin_descuento": int(len(sin_descuento)),
            "frecuencia_promedio_dias_con_descuento": freq_con,
            "frecuencia_promedio_dias_sin_descuento": freq_sin,
            "ticket_promedio_con_descuento": round(float(con_descuento['precio_num'].mean()), 0) if not con_descuento.empty else None,
            "ticket_promedio_sin_descuento": round(float(sin_descuento['precio_num'].mean()), 0) if not sin_descuento.empty else None,
            "elasticidad_estimada": elasticidad,
        })

    return {"zonas_con_descuento": resultado}
