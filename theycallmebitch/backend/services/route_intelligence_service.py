"""
Servicio de inteligencia de rutas.

Reemplaza el modelo de 3 zonas hardcodeadas (puente_alto/la_florida/macul,
con distancias fijas a mano) por densidad geográfica real, usando las
coordenadas ya geocodificadas para el Mapa de Calor. Solo lee del caché en
disco — nunca dispara geocodificación nueva (esa responsabilidad es del
Mapa de Calor).
"""
import logging
from collections import defaultdict
from typing import Dict, List

from services.geocoding_service import geocodificar_desde_cache

logger = logging.getLogger(__name__)

PRECISION_CELDA = 2  # decimales de lat/lon — ~1.1km de lado por celda


def analizar_densidad_geografica(pedidos: List[Dict]) -> Dict:
    if not pedidos:
        return {"celdas": []}

    conteo_por_celda: Dict[tuple, int] = defaultdict(int)
    for pedido in pedidos:
        if str(pedido.get('nombrelocal', '')).strip().lower() not in ('', 'aguas ancud'):
            continue
        direccion = pedido.get('dire') or pedido.get('direccion', '')
        if not direccion:
            continue
        coords = geocodificar_desde_cache(direccion)
        if not coords or coords.get('lat') is None or coords.get('lon') is None:
            continue
        celda = (round(coords['lat'], PRECISION_CELDA), round(coords['lon'], PRECISION_CELDA))
        conteo_por_celda[celda] += 1

    celdas = [
        {"lat": lat, "lon": lon, "pedidos": count}
        for (lat, lon), count in conteo_por_celda.items()
    ]
    celdas.sort(key=lambda c: -c["pedidos"])
    return {"celdas": celdas}
