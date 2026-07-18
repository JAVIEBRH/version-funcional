"""
Servicio de precio de bencina — Chile
Fuente primaria: CNE API (gratuita, sin auth)
Fallback: ENAP precio paridad (scraping ligero con regex)
Cache: 24 horas (precios cambian cada jueves en Chile)
"""
import re
import logging
from datetime import datetime
from typing import Optional
import requests

logger = logging.getLogger(__name__)

_cache = {"data": None, "timestamp": None}
CACHE_SEGUNDOS = 86400  # 24h

CNE_URL  = "https://api.cne.cl/v3/combustibles/"
ENAP_URL = "https://www.enap.cl/pag/44/803/precio_paridad"

# Último precio conocido como fallback absoluto
# Actualizar manualmente si es necesario (referencia: bencina 93, abril 2026)
_FALLBACK_PRECIO = 1497  # CLP/litro (referencia: bencina 93, abril 2026)


def _cache_valido() -> bool:
    if not _cache["timestamp"] or not _cache["data"]:
        return False
    return (datetime.now().timestamp() - _cache["timestamp"]) < CACHE_SEGUNDOS


def _intentar_cne() -> Optional[int]:
    """Intenta obtener precio 93 desde API CNE (endpoint comunitario sin auth)."""
    try:
        resp = requests.get(CNE_URL, timeout=6)
        resp.raise_for_status()
        data = resp.json()
        # La respuesta puede ser lista de combustibles
        if isinstance(data, list):
            for item in data:
                nombre = str(item.get("nombre", "")).lower()
                if "93" in nombre or (
                    "bencin" in nombre
                    and "95" not in nombre
                    and "97" not in nombre
                ):
                    precio = (
                        item.get("precio")
                        or item.get("price")
                        or item.get("valor")
                    )
                    if precio:
                        return int(float(precio))
        # Algunos endpoints devuelven dict con clave directa
        if isinstance(data, dict):
            for key in ("precio_93", "bencina_93", "93"):
                if key in data:
                    return int(float(data[key]))
    except Exception as e:
        logger.debug(f"CNE API no disponible: {e}")
    return None


def _intentar_enap() -> Optional[int]:
    """Scrapea precio paridad ENAP con regex (sin dependencias extra)."""
    try:
        resp = requests.get(
            ENAP_URL,
            timeout=8,
            headers={"User-Agent": "Mozilla/5.0 (compatible; dashboard/1.0)"},
        )
        resp.raise_for_status()
        text = resp.text
        # El precio 93 aparece en tablas HTML junto a "93"
        patterns = [
            r"93[^\d]{1,60}?(\d{3,4})\s*(?:CLP|\/L|pesos)?",
            r"Bencina 93[^\d]{0,20}(\d{3,4})",
            r"(?i)93 octanos?[^\d]{0,20}(\d{3,4})",
        ]
        for pat in patterns:
            m = re.search(pat, text)
            if m:
                val = int(m.group(1))
                if 700 <= val <= 2000:  # rango razonable CLP/litro
                    return val
    except Exception as e:
        logger.debug(f"ENAP scraping falló: {e}")
    return None


def obtener_precio_bencina() -> dict:
    """
    Retorna precio actual bencina 93 CLP/litro con fuente y timestamp.
    Estructura: {precio_litro, precio_litro_anterior, variacion_pct,
                 octanaje, estacion, fuente, timestamp, cached}
    """
    if _cache_valido():
        return {**_cache["data"], "cached": True}

    precio = None
    fuente = "fallback"

    precio = _intentar_cne()
    if precio:
        fuente = "CNE"
    else:
        precio = _intentar_enap()
        if precio:
            fuente = "ENAP"
        else:
            precio = _FALLBACK_PRECIO
            fuente = "último_conocido"

    # Precio anterior (si había cache anterior, usar ese; si no, igual al actual)
    precio_anterior = _cache["data"]["precio_litro"] if _cache["data"] else precio
    variacion_pct   = round(
        ((precio - precio_anterior) / max(precio_anterior, 1)) * 100, 2
    )

    resultado = {
        "precio_litro":          precio,
        "precio_litro_anterior": precio_anterior,
        "variacion_pct":         variacion_pct,
        "octanaje":              93,
        "estacion":              "Copec",
        "fuente":                fuente,
        "timestamp":             datetime.now().isoformat(),
        "cached":                False,
    }

    _cache["data"]      = resultado
    _cache["timestamp"] = datetime.now().timestamp()
    logger.info(f"Precio bencina 93: ${precio} CLP/L (fuente: {fuente})")
    return resultado
