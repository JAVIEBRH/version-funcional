"""
Servicio de Geocoding — Nominatim (OpenStreetMap, sin API key).
Convierte direcciones de texto en coordenadas reales para el mapa de calor,
para pedidos que no tienen lat/lon guardado en el sistema de origen.

Los resultados quedan cacheados en disco (geocode_cache.json): cada dirección
se geocodifica una sola vez en su vida. Direcciones nuevas que vayan
apareciendo con el tiempo se geocodifican solas la primera vez que se ven,
sin necesidad de tocar este código.
"""
import os
import json
import time
import logging
import requests

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "AguasAncudDashboard/1.0 (uso interno - panel de control de pedidos)"

RUTA_CACHE = os.path.join(os.path.dirname(__file__), '..', 'geocode_cache.json')

# Nominatim exige un máximo de 1 solicitud por segundo (política de uso gratuito)
INTERVALO_MIN_SEGUNDOS = 1.1

_cache = None
_ultima_solicitud = 0.0


def _cargar_cache():
    global _cache
    if _cache is not None:
        return _cache
    try:
        with open(RUTA_CACHE, 'r', encoding='utf-8') as f:
            _cache = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        _cache = {}
    return _cache


def _guardar_cache():
    try:
        with open(RUTA_CACHE, 'w', encoding='utf-8') as f:
            json.dump(_cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"No se pudo guardar geocode_cache.json: {e}")


def esta_en_cache(direccion: str) -> bool:
    """True si esta dirección ya fue procesada antes (con éxito o sin éxito)."""
    cache = _cargar_cache()
    clave = (direccion or '').strip().lower()
    return clave in cache


def geocodificar_desde_cache(direccion: str):
    """Devuelve coordenadas SOLO si la dirección ya fue geocodificada antes
    (no hace ninguna llamada de red). Úsalo en el camino síncrono de un
    endpoint; usa geocodificar_lote() en una tarea de background para
    resolver direcciones nuevas sin bloquear la respuesta HTTP."""
    cache = _cargar_cache()
    clave = (direccion or '').strip().lower()
    return cache.get(clave)


def geocodificar(direccion: str):
    """Devuelve {'lat': float, 'lon': float} para una dirección, o None si no
    se pudo geocodificar. Usa caché en disco: una dirección ya vista (con
    éxito o sin éxito) nunca vuelve a golpear la API."""
    global _ultima_solicitud
    cache = _cargar_cache()
    clave = (direccion or '').strip().lower()
    if not clave:
        return None

    if clave in cache:
        return cache[clave]

    espera = INTERVALO_MIN_SEGUNDOS - (time.time() - _ultima_solicitud)
    if espera > 0:
        time.sleep(espera)

    coords = None
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={
                'q': direccion,
                'format': 'json',
                'limit': 1,
                'countrycodes': 'cl',
                # Sesga la búsqueda hacia la Región Metropolitana (zona real de reparto)
                'viewbox': '-71.2,-33.2,-70.2,-33.9',
                'bounded': 0,
            },
            headers={'User-Agent': USER_AGENT},
            timeout=8,
        )
        _ultima_solicitud = time.time()
        resp.raise_for_status()
        resultados = resp.json()
        if resultados:
            coords = {'lat': float(resultados[0]['lat']), 'lon': float(resultados[0]['lon'])}
    except Exception as e:
        _ultima_solicitud = time.time()
        logger.warning(f"Error geocodificando '{direccion}': {e}")

    cache[clave] = coords
    _guardar_cache()
    return coords


def geocodificar_lote(direcciones, limite_nuevas=25):
    """Geocodifica una lista de direcciones únicas y devuelve
    {direccion: {'lat':..,'lon':..} | None}. Las que ya están en caché
    responden al instante; "limite_nuevas" acota cuántas direcciones NUNCA
    vistas se geocodifican en una sola llamada (para no dejar el request
    HTTP colgado si aparecen muchas direcciones nuevas de golpe — el resto
    se completa solo en las siguientes actualizaciones)."""
    cache = _cargar_cache()
    resultado = {}
    nuevas_procesadas = 0
    for direccion in direcciones:
        clave = (direccion or '').strip().lower()
        if not clave:
            continue
        if clave in cache:
            resultado[direccion] = cache[clave]
            continue
        if nuevas_procesadas >= limite_nuevas:
            continue
        resultado[direccion] = geocodificar(direccion)
        nuevas_procesadas += 1
    if nuevas_procesadas:
        logger.info(f"Geocoding: {nuevas_procesadas} direcciones nuevas procesadas")
    return resultado
