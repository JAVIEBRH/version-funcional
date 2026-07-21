"""
Servicio de detección de oportunidad mayorista por edificio/condominio.

Agrupa pedidos por DIRECCIÓN normalizada, no por usuario/email — varios
"clientes" con emails auto-generados distintos pueden ser, en realidad,
distintos departamentos del mismo edificio pidiendo cada uno por su
cuenta. Eso es una oportunidad real de contrato mayorista único que hoy
no se ve en ningún lado, porque todo el resto del sistema agrupa por
usuario.
"""
import logging
import re
from typing import Dict, List

import pandas as pd

logger = logging.getLogger(__name__)

MIN_CLIENTES_DISTINTOS = 3


def _normalizar_direccion(direccion: str) -> str:
    addr = (direccion or '').strip().lower()
    # Remove unit/apartment identifiers like "depto A", "apt 1", etc.
    # to group different units in the same building together
    addr = re.sub(r'^(depto|apt|apartment|piso|floor|unit|no\.?)\s+[a-z0-9]+[,\s]*', '', addr)
    return addr.strip()


def detectar_oportunidad_edificio(pedidos: List[Dict]) -> Dict:
    df = pd.DataFrame(pedidos)
    if df.empty:
        return {"edificios": []}
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if df.empty or 'dire' not in df.columns or 'usuario' not in df.columns:
        return {"edificios": []}

    df['direccion_norm'] = df['dire'].apply(_normalizar_direccion)
    df = df[df['direccion_norm'] != '']
    # Fix for missing-column bug: df.get() returns scalar if column missing,
    # so we need to check first to avoid AttributeError on .fillna()
    if 'precio' in df.columns:
        df['precio_num'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)
    else:
        df['precio_num'] = 0

    resultado = []
    for direccion, grupo in df.groupby('direccion_norm'):
        clientes_distintos = grupo['usuario'].nunique()
        if clientes_distintos < MIN_CLIENTES_DISTINTOS:
            continue
        resultado.append({
            "direccion": direccion,
            "clientes_distintos": int(clientes_distintos),
            "pedidos_totales": int(len(grupo)),
            "revenue_total": round(float(grupo['precio_num'].sum()), 0),
        })

    resultado.sort(key=lambda e: -e['pedidos_totales'])
    return {"edificios": resultado}
