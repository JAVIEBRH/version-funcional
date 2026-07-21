"""
Servicio de clasificación de churn estacional vs real.

Antes de tratar a un cliente "inactivo" (ya calculado por
customer_risk_service) como perdido para siempre, revisa si su propio
historial completo muestra un patrón de inactividad que se repite en la
misma época todos los años — un cliente así no debería recibir la misma
urgencia que alguien realmente perdido.
"""
import logging
from datetime import datetime
from typing import Dict, List

import pandas as pd

logger = logging.getLogger(__name__)

MIN_ANOS_HISTORIAL = 2
MIN_PEDIDOS_POR_CLIENTE = 3


def _parsear_fecha(fecha_str):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def _es_patron_estacional(fechas: list) -> bool:
    if len(fechas) < MIN_PEDIDOS_POR_CLIENTE:
        return False
    anos = set(f.year for f in fechas)
    if len(anos) < MIN_ANOS_HISTORIAL:
        return False
    # Para cada trimestre, contar cuántos años tienen actividad en ese trimestre.
    # Si algún trimestre tiene actividad en 2+ años, significa que el cliente
    # compra en esa época todos los años — es estacional.
    trimestres_anos = {}
    for f in fechas:
        trimestre = (f.month - 1) // 3  # trimestre 0-3
        trimestres_anos.setdefault(trimestre, set()).add(f.year)
    # Si algún trimestre aparece en 2+ años diferentes, es estacional
    for years in trimestres_anos.values():
        if len(years) >= MIN_ANOS_HISTORIAL:
            return True
    return False


def clasificar_churn_estacional(pedidos: List[Dict], clientes_inactivos: List[Dict]) -> Dict:
    if not clientes_inactivos:
        return {"clientes": []}

    df = pd.DataFrame(pedidos)
    if not df.empty and 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if not df.empty:
        df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
        df = df.dropna(subset=['fecha_dt'])

    resultado = []
    for cliente in clientes_inactivos:
        usuario = cliente.get('usuario')
        fechas = sorted(df[df['usuario'] == usuario]['fecha_dt'].tolist()) if not df.empty else []
        clasificacion = "estacional" if _es_patron_estacional(fechas) else "real"
        resultado.append({"usuario": usuario, "clasificacion": clasificacion})

    return {"clientes": resultado}
