"""
Motor RFM — Recency, Frequency, Monetary
Clasifica cada cliente y detecta churn en tiempo real.
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

# Segmentos RFM con umbrales de dias para churn
SEGMENTOS = {
    "campeon":          {"label": "Campeón",          "color": "#10b981", "churn_dias": 30},
    "leal":             {"label": "Cliente Leal",      "color": "#3b82f6", "churn_dias": 40},
    "potencial_leal":   {"label": "Potencial Leal",    "color": "#8b5cf6", "churn_dias": 35},
    "nuevo":            {"label": "Cliente Nuevo",     "color": "#06b6d4", "churn_dias": 45},
    "prometedor":       {"label": "Prometedor",        "color": "#f59e0b", "churn_dias": 40},
    "necesita_atencion":{"label": "Necesita Atención", "color": "#f97316", "churn_dias": 25},
    "en_riesgo":        {"label": "En Riesgo",         "color": "#ef4444", "churn_dias": 20},
    "perdido":          {"label": "Perdido",           "color": "#6b7280", "churn_dias": 0},
}


def _parsear_fecha(fecha_str: str):
    """Intenta parsear DD-MM-YYYY o YYYY-MM-DD."""
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(fecha_str[:10], fmt)
        except:
            pass
    return None


def calcular_rfm(pedidos: List[Dict]) -> Dict:
    """
    Recibe lista de pedidos normalizados y devuelve análisis RFM completo.
    """
    if not pedidos:
        return _respuesta_vacia()

    try:
        df = pd.DataFrame(pedidos)

        # Filtrar Aguas Ancud
        if 'nombrelocal' in df.columns:
            df = df[df['nombrelocal'].str.strip().str.lower() == 'aguas ancud']

        # Necesitamos usuario, fecha y precio
        for col in ['usuario', 'fecha', 'precio']:
            if col not in df.columns:
                return _respuesta_vacia()

        df = df[df['usuario'].str.strip() != '']
        df['precio_num'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)
        df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
        df = df.dropna(subset=['fecha_dt'])

        if df.empty:
            return _respuesta_vacia()

        hoy = datetime.now()

        # Calcular R, F, M por cliente
        rfm = df.groupby('usuario').agg(
            ultima_compra=('fecha_dt', 'max'),
            frecuencia=('usuario', 'count'),
            monetario=('precio_num', 'sum')
        ).reset_index()

        rfm['recencia_dias'] = (hoy - rfm['ultima_compra']).dt.days

        # Enriquecer con dirección y teléfono
        info = df.sort_values('fecha_dt', ascending=False).drop_duplicates('usuario').set_index('usuario')
        rfm['direccion'] = rfm['usuario'].map(lambda u: info.loc[u, 'dire'] if u in info.index and 'dire' in info.columns else '')
        rfm['telefono'] = rfm['usuario'].map(lambda u: info.loc[u, 'telefonou'] if u in info.index and 'telefonou' in info.columns else '')

        # Calcular cadencia promedio por cliente (dias entre pedidos)
        def cadencia_cliente(u):
            fechas = df[df['usuario'] == u]['fecha_dt'].sort_values()
            if len(fechas) < 2:
                return 30  # default
            diffs = [(fechas.iloc[i+1] - fechas.iloc[i]).days for i in range(len(fechas)-1)]
            return max(int(np.mean(diffs)), 1)

        rfm['cadencia_dias'] = rfm['usuario'].apply(cadencia_cliente)

        # Scoring quintiles (1=peor, 5=mejor)
        rfm['r_score'] = _score_quintil(rfm['recencia_dias'], inverso=True)
        rfm['f_score'] = _score_quintil(rfm['frecuencia'], inverso=False)
        rfm['m_score'] = _score_quintil(rfm['monetario'], inverso=False)
        rfm['rfm_score'] = rfm['r_score'] + rfm['f_score'] + rfm['m_score']

        # Clasificar segmento
        rfm['segmento'] = rfm.apply(_clasificar_segmento, axis=1)

        # Probabilidad de churn (0-100%)
        rfm['churn_prob'] = rfm.apply(lambda row: _calcular_churn(row), axis=1)

        # Clientes en riesgo de fuga inminente (churn > 70%)
        en_riesgo = rfm[rfm['churn_prob'] >= 70].sort_values('monetario', ascending=False)

        # Resumen por segmento
        resumen_segmentos = rfm.groupby('segmento').agg(
            cantidad=('usuario', 'count'),
            revenue_total=('monetario', 'sum')
        ).reset_index().to_dict('records')

        # Top 10 clientes en riesgo (ordenados por dinero perdido potencial)
        clientes_en_riesgo = []
        for _, row in en_riesgo.head(10).iterrows():
            clientes_en_riesgo.append({
                'usuario': row['usuario'],
                'telefono': str(row['telefono']),
                'direccion': str(row['direccion']),
                'segmento': row['segmento'],
                'recencia_dias': int(row['recencia_dias']),
                'frecuencia': int(row['frecuencia']),
                'monetario': int(row['monetario']),
                'churn_prob': round(float(row['churn_prob']), 1),
                'cadencia_dias': int(row['cadencia_dias']),
                'dias_sobre_cadencia': max(0, int(row['recencia_dias']) - int(row['cadencia_dias']))
            })

        # Top 10 campeones
        campeones = rfm[rfm['segmento'] == 'campeon'].sort_values('monetario', ascending=False).head(10)
        clientes_campeon = []
        for _, row in campeones.iterrows():
            clientes_campeon.append({
                'usuario': row['usuario'],
                'monetario': int(row['monetario']),
                'frecuencia': int(row['frecuencia']),
                'recencia_dias': int(row['recencia_dias'])
            })

        # Métricas globales
        total_clientes = len(rfm)
        total_en_riesgo = len(rfm[rfm['churn_prob'] >= 70])
        revenue_en_riesgo = int(en_riesgo['monetario'].sum())
        clientes_perdidos = len(rfm[rfm['segmento'] == 'perdido'])
        revenue_perdido = int(rfm[rfm['segmento'] == 'perdido']['monetario'].sum())
        ticket_promedio_global = int(rfm['monetario'].sum() / rfm['frecuencia'].sum()) if rfm['frecuencia'].sum() > 0 else 0

        segmento_por_cliente = dict(zip(rfm['usuario'], rfm['segmento']))

        return {
            'total_clientes': total_clientes,
            'clientes_en_riesgo_count': total_en_riesgo,
            'revenue_en_riesgo': revenue_en_riesgo,
            'clientes_perdidos_count': clientes_perdidos,
            'revenue_perdido_historico': revenue_perdido,
            'ticket_promedio_global': ticket_promedio_global,
            'resumen_segmentos': resumen_segmentos,
            'clientes_en_riesgo': clientes_en_riesgo,
            'clientes_campeon': clientes_campeon,
            'segmento_por_cliente': segmento_por_cliente,
        }

    except Exception as e:
        logger.error(f"Error en calcular_rfm: {e}", exc_info=True)
        return _respuesta_vacia()


def _score_quintil(serie: pd.Series, inverso: bool) -> pd.Series:
    """Asigna score 1-5 por quintiles."""
    try:
        labels = [5, 4, 3, 2, 1] if inverso else [1, 2, 3, 4, 5]
        return pd.qcut(serie, q=5, labels=labels, duplicates='drop').astype(int)
    except:
        return pd.Series([3] * len(serie), index=serie.index)


def _clasificar_segmento(row) -> str:
    r, f, m = row['r_score'], row['f_score'], row['m_score']
    if r >= 4 and f >= 4 and m >= 4:
        return 'campeon'
    elif r >= 3 and f >= 3:
        return 'leal'
    elif r >= 4 and f <= 2:
        return 'nuevo'
    elif r >= 3 and f <= 2:
        return 'prometedor'
    elif r <= 2 and f >= 3 and m >= 3:
        return 'en_riesgo'
    elif r <= 2 and f >= 2:
        return 'necesita_atencion'
    elif r == 1:
        return 'perdido'
    else:
        return 'potencial_leal'


def _calcular_churn(row) -> float:
    """Probabilidad de churn 0-100% basada en recencia vs cadencia esperada."""
    cadencia = max(row['cadencia_dias'], 7)
    recencia = row['recencia_dias']
    ratio = recencia / cadencia
    if ratio <= 1.0:
        return max(0.0, (ratio - 0.5) * 20)
    elif ratio <= 1.5:
        return 30.0 + (ratio - 1.0) * 80
    elif ratio <= 2.5:
        return 70.0 + (ratio - 1.5) * 20
    else:
        return min(99.0, 90.0 + (ratio - 2.5) * 5)


def _respuesta_vacia() -> Dict:
    return {
        'total_clientes': 0,
        'clientes_en_riesgo_count': 0,
        'revenue_en_riesgo': 0,
        'clientes_perdidos_count': 0,
        'revenue_perdido_historico': 0,
        'ticket_promedio_global': 0,
        'resumen_segmentos': [],
        'clientes_en_riesgo': [],
        'clientes_campeon': [],
        'segmento_por_cliente': {},
    }
