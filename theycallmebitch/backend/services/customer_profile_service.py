"""
Servicio de perfil de cliente.

No existe una base de clientes real (el endpoint legacy que la alimentaba
está muerto — ver docs/superpowers/specs/2026-07-18-clientes-redesign-design.md).
Este módulo agrega TODOS los pedidos de cada cliente y usa el pedido MÁS
RECIENTE para los datos de contacto (dirección/teléfono), en vez de
congelar el primer pedido que se haya visto — así si un cliente se mudó o
cambió de número, el perfil lo refleja.
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)


def _parsear_fecha(fecha_str: Optional[str]):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def construir_perfiles_clientes(pedidos: List[Dict]) -> List[Dict]:
    """Devuelve una fila por cliente único (agrupado por `usuario`), con
    contacto tomado del pedido más reciente y totales reales agregados."""
    df = pd.DataFrame(pedidos)
    if df.empty:
        return []

    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if 'usuario' not in df.columns:
        return []
    df = df[df['usuario'].astype(str).str.strip() != '']
    if df.empty:
        return []

    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])
    if df.empty:
        return []
    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)

    perfiles = []
    for usuario, grupo in df.groupby('usuario'):
        grupo_ordenado = grupo.sort_values('fecha_dt', ascending=False)
        mas_reciente = grupo_ordenado.iloc[0]
        primera_compra = grupo['fecha_dt'].min()
        ultimo_pedido = grupo['fecha_dt'].max()

        perfiles.append({
            'usuario': usuario,
            'direccion': str(mas_reciente.get('dire', '') or ''),
            'telefono': str(mas_reciente.get('telefonou', '') or ''),
            'pedidos': int(len(grupo)),
            'total_comprado': float(grupo['precio_num'].sum()),
            'ultimo_pedido': ultimo_pedido.strftime('%d-%m-%Y'),
            'primera_compra': primera_compra.strftime('%d-%m-%Y'),
        })

    return perfiles
