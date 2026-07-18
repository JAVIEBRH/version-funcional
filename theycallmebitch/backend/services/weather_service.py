"""
Servicio de Clima — Open-Meteo (sin API key, gratuito)
Obtiene forecast para Puente Alto y calcula multiplicador de demanda.
"""
import requests
import logging
from datetime import datetime
from typing import Dict

logger = logging.getLogger(__name__)

# Coordenadas de Puente Alto, Santiago (ubicación real de Aguas Ancud)
LAT = -33.5699
LON = -70.5797

# Cache simple en memoria (2 horas)
_cache = {"data": None, "timestamp": None}
CACHE_SEGUNDOS = 7200

# Mapeo de weather codes de Open-Meteo a descripciones en español
_WMO_DESCRIPCIONES = {
    0: "despejado",
    1: "mayormente despejado", 2: "parcialmente nublado", 3: "nublado",
    45: "neblina", 48: "neblina con escarcha",
    51: "llovizna ligera", 53: "llovizna moderada", 55: "llovizna intensa",
    61: "lluvia ligera", 63: "lluvia moderada", 65: "lluvia intensa",
    71: "nieve ligera", 73: "nieve moderada", 75: "nieve intensa",
    80: "chubascos ligeros", 81: "chubascos moderados", 82: "chubascos fuertes",
    95: "tormenta", 96: "tormenta con granizo", 99: "tormenta con granizo fuerte",
}


def _cache_valido() -> bool:
    if not _cache["timestamp"] or not _cache["data"]:
        return False
    return (datetime.now().timestamp() - _cache["timestamp"]) < CACHE_SEGUNDOS


def _multiplicador_demanda(temp_c: float) -> float:
    """
    Calcula cuánto sube/baja la demanda de agua según temperatura.
    Coeficiente calibrado con regresión lineal sobre 128 días reales
    de Aguas Ancud (oct 2025 → abr 2026, 912 pedidos).
    - Correlación Pearson r=0.10 (débil: temperatura no es el factor dominante)
    - Coeficiente real: +2.0% por grado sobre 10°C
    - Bajo 10°C se aplica la mitad del efecto (pocos datos en ese rango)
    """
    diff = temp_c - 10.0
    if diff >= 0:
        return round(1.0 + diff * 0.02, 2)
    else:
        return round(max(0.8, 1.0 + diff * 0.01), 2)


def obtener_clima() -> Dict:
    """Retorna clima actual + forecast 5 días + multiplicador de demanda."""
    if _cache_valido():
        return _cache["data"]

    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={LAT}&longitude={LON}"
            f"&current=temperature_2m,relative_humidity_2m,precipitation,weather_code"
            f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code"
            f"&timezone=America%2FSantiago&forecast_days=5"
        )
        resp = requests.get(url, timeout=8)
        resp.raise_for_status()
        data = resp.json()

        current = data["current"]
        daily = data["daily"]

        temp_actual = round(current["temperature_2m"], 1)
        humedad = current["relative_humidity_2m"]
        lluvia_hoy = current.get("precipitation", 0) or 0
        wcode_actual = current.get("weather_code", 0)
        descripcion = _WMO_DESCRIPCIONES.get(wcode_actual, "despejado")

        # Forecast 5 días
        forecast_lista = []
        fechas = daily.get("time", [])
        for i, fecha in enumerate(fechas[:5]):
            tmax = daily["temperature_2m_max"][i]
            tmin = daily["temperature_2m_min"][i]
            lluvia_mm = daily["precipitation_sum"][i] or 0
            wcode = daily["weather_code"][i]
            temp_media = (tmax + tmin) / 2
            forecast_lista.append({
                "fecha": fecha,
                "temp_max": round(tmax, 1),
                "temp_min": round(tmin, 1),
                "descripcion": _WMO_DESCRIPCIONES.get(wcode, "despejado"),
                "lluvia_mm": round(lluvia_mm, 1),
                "multiplicador_demanda": _multiplicador_demanda(temp_media),
            })

        multiplicador_hoy = _multiplicador_demanda(temp_actual)

        resultado = {
            "temp_actual": temp_actual,
            "descripcion": descripcion,
            "humedad": humedad,
            "lluvia_hoy_mm": round(lluvia_hoy, 1),
            "multiplicador_demanda_hoy": multiplicador_hoy,
            "impacto_demanda_pct": round((multiplicador_hoy - 1.0) * 100, 1),
            "forecast_5_dias": forecast_lista,
            "fuente": "open-meteo",
            "timestamp": datetime.now().isoformat(),
        }

        _cache["data"] = resultado
        _cache["timestamp"] = datetime.now().timestamp()
        logger.info(f"Clima obtenido desde Open-Meteo: {temp_actual}°C, {descripcion}")
        return resultado

    except Exception as e:
        logger.error(f"Error obteniendo clima desde Open-Meteo: {e}")
        return _datos_simulados()


def _datos_simulados() -> Dict:
    """Datos de respaldo si Open-Meteo falla."""
    import random
    temp = round(random.uniform(8.0, 18.0), 1)
    mult = _multiplicador_demanda(temp)
    return {
        "temp_actual": temp,
        "descripcion": "parcialmente nublado",
        "humedad": 75,
        "lluvia_hoy_mm": 0,
        "multiplicador_demanda_hoy": mult,
        "impacto_demanda_pct": round((mult - 1.0) * 100, 1),
        "forecast_5_dias": [],
        "fuente": "simulado",
        "timestamp": datetime.now().isoformat(),
    }
