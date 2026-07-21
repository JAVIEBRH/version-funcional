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
    # Solo se consideran los dos años más recientes del historial del cliente.
    # Un trimestre es "estacional" únicamente si está activo en AMBOS de esos
    # dos años — no basta con que coincida en dos años cualesquiera de un
    # historial largo (eso produciría falsos positivos por pura coincidencia).
    dos_anos_recientes = sorted(anos)[-2:]
    ano_anterior, ano_reciente = dos_anos_recientes[0], dos_anos_recientes[1]

    trimestres_por_ano = {ano_anterior: set(), ano_reciente: set()}
    for f in fechas:
        if f.year in trimestres_por_ano:
            trimestre = (f.month - 1) // 3  # trimestre 0-3
            trimestres_por_ano[f.year].add(trimestre)

    interseccion = trimestres_por_ano[ano_anterior] & trimestres_por_ano[ano_reciente]
    return len(interseccion) > 0


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
