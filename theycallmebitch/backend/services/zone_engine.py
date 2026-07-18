"""
Motor de Análisis de Zonas
Detecta zonas activas, dormidas y oportunidades de expansión.
"""
import pandas as pd
import re
from datetime import datetime, timedelta
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

# Mapa de palabras clave → zona
# Zonas de reparto activas: Puente Alto, La Florida, Macul
# Distancias aprox. desde Lago La Paloma 4565, Villa El Alba, Puente Alto:
#   puente_alto: 0-3 km | la_florida: ~8 km | macul: ~12 km
ZONAS_KEYWORDS = {
    "puente_alto": [
        # Sectores y avenidas principales
        "puente alto", "villa el alba", "chacabuco", "concha y toro", "camilo henriquez",
        "eyzaguirre", "lo martinez", "gabriela", "padre hurtado", "cardenal silva",
        "baquedano", "angamos", "la paloma", "canal san carlos", "av. central",
        "santa rosa", "los presidentes", "observatorio", "los condores",
        # Sector Lagos (calles con nombres de lagos)
        "lago general carrera", "lago yulton", "lago cochrane", "lago llanquihue",
        "lago villarrica", "lago rapel", "lago chapo", "lago ranco", "lago panguipulli",
        "lago todos los santos", "lago colico", "lago calafquen", "lago riesco",
        "lago del desierto", "lago bertrand", "lago fagnano", "lago blanco",
        "lago argentino", "lago puelo", "lago traful", "lago lacar",
        # Sector Ríos (calles con nombres de ríos)
        "rio tolten", "rio baker", "rio colegual", "rio petrohue", "rio limarí",
        "rio biobio", "rio maipo", "rio tinguiririca", "rio cachapoal", "rio claro",
        "rio nilahue", "rio cholguaco", "rio negro", "rio ibanez", "rio simpson",
        "rio azul", "rio serrano", "rio exploradores", "rio palena",
        # Calles con nombres de aves (sector ornitológico Puente Alto)
        "martin pescador", "chorlito", "canquen", "canelo", "pato",
        "gaviota", "pelicano", "flamenco", "becada", "pitio",
        # Otros sectores de Puente Alto
        "petrohue", "cholguaco", "nilahue", "parque del este", "parque brasil",
        "general carrera", "talladores", "bentonita", "pedernal",
        "el caiti", "geronimo de alderete", "punta arenas", "estrella del sur",
        "pasaje", "villa hermosa", "villa nueva", "el canquen",
        "froilan roa", "manso de velasco", "jose de morandé",
        "cruces", "vienes", "baker",
    ],
    "la_florida": [
        "la florida", "pudeto", "huito", "vicuna mackenna", "trinidad",
        "rojas magallanes", "walker martinez", "pastor fernandez",
        "san jose de la florida", "joaquin edwards", "froilan roa",
        "los militares", "americo vespucio", "av. florida", "los quillayes",
    ],
    "macul": [
        "macul", "tobalaba", "grecia", "irarrazaval", "departamental",
        "las parcelas", "av. macul", "rodrigo de araya", "penalolen",
        "ossa", "lo ovalle",
    ],
}


def _detectar_zona(direccion: str) -> str:
    """Detecta la zona desde la dirección usando keywords."""
    if not isinstance(direccion, str) or not direccion.strip():
        return "sin_direccion"
    addr_lower = direccion.lower()
    for zona, keywords in ZONAS_KEYWORDS.items():
        for kw in keywords:
            if kw in addr_lower:
                return zona
    # Si contiene número de 4-5 dígitos típico de Puente Alto, clasificar ahí
    if re.search(r'\b0\d{4}\b|\b\d{4,5}\b', direccion):
        return "puente_alto"
    return "sin_clasificar"


def _parsear_fecha(fecha_str: str):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except:
            pass
    return None


def analizar_zonas(pedidos: List[Dict]) -> Dict:
    """
    Analiza distribución geográfica de pedidos y detecta oportunidades de zona.
    """
    if not pedidos:
        return _respuesta_vacia()

    try:
        df = pd.DataFrame(pedidos)

        if 'nombrelocal' in df.columns:
            df = df[df['nombrelocal'].str.strip().str.lower() == 'aguas ancud']

        if df.empty:
            return _respuesta_vacia()

        df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)
        df['fecha_dt'] = df['fecha'].apply(_parsear_fecha) if 'fecha' in df.columns else None
        df['zona'] = df['dire'].apply(_detectar_zona) if 'dire' in df.columns else 'otras'

        hoy = datetime.now()
        hace_30 = hoy - timedelta(days=30)
        hace_60 = hoy - timedelta(days=60)
        hace_90 = hoy - timedelta(days=90)

        # Métricas por zona — total histórico
        zona_total = df.groupby('zona').agg(
            pedidos_total=('zona', 'count'),
            revenue_total=('precio_num', 'sum'),
            clientes_unicos=('usuario', 'nunique') if 'usuario' in df.columns else ('zona', 'count'),
            ultima_actividad=('fecha_dt', 'max'),
        ).reset_index()

        # Pedidos últimos 30 días
        df_30 = df[df['fecha_dt'] >= hace_30] if df['fecha_dt'].notna().any() else pd.DataFrame()
        zona_30 = df_30.groupby('zona').agg(
            pedidos_30d=('zona', 'count'),
            revenue_30d=('precio_num', 'sum')
        ).reset_index() if not df_30.empty else pd.DataFrame(columns=['zona', 'pedidos_30d', 'revenue_30d'])

        # Pedidos 30-60 días (mes anterior)
        df_60 = df[(df['fecha_dt'] >= hace_60) & (df['fecha_dt'] < hace_30)] if df['fecha_dt'].notna().any() else pd.DataFrame()
        zona_60 = df_60.groupby('zona').agg(
            pedidos_60d=('zona', 'count'),
            revenue_60d=('precio_num', 'sum')
        ).reset_index() if not df_60.empty else pd.DataFrame(columns=['zona', 'pedidos_60d', 'revenue_60d'])

        # Merge
        zonas = zona_total.merge(zona_30, on='zona', how='left').merge(zona_60, on='zona', how='left')
        zonas = zonas.fillna(0)

        # Calcular tendencia (crecimiento o caída)
        def tendencia(row):
            p30 = row.get('pedidos_30d', 0)
            p60 = row.get('pedidos_60d', 0)
            if p60 == 0:
                return 100.0 if p30 > 0 else 0.0
            return round(((p30 - p60) / p60) * 100, 1)

        zonas['tendencia_pct'] = zonas.apply(tendencia, axis=1)
        zonas['dias_sin_actividad'] = zonas['ultima_actividad'].apply(
            lambda x: (hoy - x).days if pd.notna(x) and x else 999
        )

        # Clasificar cada zona
        def clasificar_zona(row):
            d30 = row.get('pedidos_30d', 0)
            dias = row.get('dias_sin_actividad', 999)
            tend = row.get('tendencia_pct', 0)
            if dias > 60:
                return 'dormida'
            elif d30 == 0:
                return 'inactiva'
            elif tend >= 20:
                return 'creciendo'
            elif tend <= -20:
                return 'cayendo'
            else:
                return 'estable'

        zonas['estado'] = zonas.apply(clasificar_zona, axis=1)

        # Zona estrella (más revenue 30d)
        zona_top = zonas.sort_values('revenue_30d', ascending=False).iloc[0] if not zonas.empty else None

        # Zonas dormidas con historial (oportunidades de reactivación)
        oportunidades = zonas[
            (zonas['estado'].isin(['dormida', 'inactiva'])) &
            (zonas['revenue_total'] > 0)
        ].sort_values('revenue_total', ascending=False)

        # Zonas cayendo (alertas)
        zonas_cayendo = zonas[zonas['estado'] == 'cayendo'].sort_values('tendencia_pct')

        # Construir respuesta detallada
        zonas_list = []
        for _, row in zonas.iterrows():
            zonas_list.append({
                'zona': row['zona'],
                'estado': row['estado'],
                'pedidos_total': int(row['pedidos_total']),
                'revenue_total': int(row['revenue_total']),
                'pedidos_30d': int(row.get('pedidos_30d', 0)),
                'revenue_30d': int(row.get('revenue_30d', 0)),
                'clientes_unicos': int(row['clientes_unicos']),
                'tendencia_pct': float(row['tendencia_pct']),
                'dias_sin_actividad': int(row['dias_sin_actividad']),
            })

        oportunidades_list = []
        for _, row in oportunidades.head(5).iterrows():
            oportunidades_list.append({
                'zona': row['zona'],
                'revenue_historico': int(row['revenue_total']),
                'dias_inactiva': int(row['dias_sin_actividad']),
                'pedidos_historicos': int(row['pedidos_total']),
                'accion': f"Zona '{row['zona']}' sin pedidos hace {int(row['dias_sin_actividad'])} días. Revenue histórico: ${int(row['revenue_total']):,}. Activar campaña de recontacto."
            })

        alertas_caida = []
        for _, row in zonas_cayendo.head(3).iterrows():
            alertas_caida.append({
                'zona': row['zona'],
                'caida_pct': float(row['tendencia_pct']),
                'revenue_perdido': int(row.get('revenue_60d', 0) - row.get('revenue_30d', 0)),
            })

        return {
            'zonas': zonas_list,
            'zona_lider': zona_top['zona'] if zona_top is not None else 'N/A',
            'zona_lider_revenue_30d': int(zona_top['revenue_30d']) if zona_top is not None else 0,
            'oportunidades_reactivacion': oportunidades_list,
            'alertas_caida': alertas_caida,
            'total_zonas_activas': int(len(zonas[zonas['pedidos_30d'] > 0])),
            'total_zonas_dormidas': int(len(zonas[zonas['estado'] == 'dormida'])),
        }

    except Exception as e:
        logger.error(f"Error en analizar_zonas: {e}", exc_info=True)
        return _respuesta_vacia()


def _respuesta_vacia() -> Dict:
    return {
        'zonas': [],
        'zona_lider': 'N/A',
        'zona_lider_revenue_30d': 0,
        'oportunidades_reactivacion': [],
        'alertas_caida': [],
        'total_zonas_activas': 0,
        'total_zonas_dormidas': 0,
    }
