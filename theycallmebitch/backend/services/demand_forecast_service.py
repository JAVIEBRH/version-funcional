"""
Servicio de pronóstico de demanda — XGBoost con regresión por cuantiles.

Predice pedidos esperados por día para los próximos N días, con un rango
(P10-P90) en vez de un solo número. El modelo se entrena en cada llamada
sobre los pedidos reales más recientes — no hay modelo serializado que
pueda desactualizarse.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

logger = logging.getLogger(__name__)

QUANTILES = {'p10': 0.1, 'p50': 0.5, 'p90': 0.9}
FEATURES = ['dow', 'dom', 'month', 'is_weekend', 'lag7', 'lag14', 'lag30', 'temp', 'trend_day']
MIN_DIAS_ENTRENAMIENTO = 14


def _parsear_fecha(fecha_str: Optional[str]):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def construir_serie_diaria(pedidos: List[Dict]) -> pd.DataFrame:
    """Convierte la lista cruda de pedidos en una serie de un renglón por
    día con el conteo de pedidos de ese día. Días sin pedidos quedan en 0."""
    df = pd.DataFrame(pedidos)
    if df.empty or 'fecha' not in df.columns:
        return pd.DataFrame(columns=['fecha', 'pedidos'])

    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])
    if df.empty:
        return pd.DataFrame(columns=['fecha', 'pedidos'])

    conteo = df.groupby(df['fecha_dt'].dt.date).size().rename('pedidos').reset_index()
    conteo = conteo.rename(columns={'fecha_dt': 'fecha'})

    rango = pd.date_range(conteo['fecha'].min(), conteo['fecha'].max(), freq='D')
    serie = pd.DataFrame({'fecha': rango.date})
    serie = serie.merge(conteo, on='fecha', how='left')
    serie['pedidos'] = serie['pedidos'].fillna(0).astype(int)
    return serie


def agregar_features(serie: pd.DataFrame, temperaturas_por_fecha: Dict = None) -> pd.DataFrame:
    """Agrega features de calendario, rezago y tendencia a la serie diaria.
    `temperaturas_por_fecha`: dict opcional {date: temp_c}; las fechas sin
    dato usan 15.0 (temperatura de referencia) para no romper el
    entrenamiento por falta de clima histórico."""
    serie = serie.copy().reset_index(drop=True)
    fechas = pd.to_datetime(serie['fecha'])
    serie['dow'] = fechas.dt.dayofweek
    serie['dom'] = fechas.dt.day
    serie['month'] = fechas.dt.month
    serie['is_weekend'] = (serie['dow'] >= 5).astype(int)
    serie['lag7'] = serie['pedidos'].rolling(7, min_periods=1).mean().shift(1)
    serie['lag14'] = serie['pedidos'].rolling(14, min_periods=1).mean().shift(1)
    serie['lag30'] = serie['pedidos'].rolling(30, min_periods=1).mean().shift(1)
    serie['trend_day'] = range(len(serie))

    temperaturas_por_fecha = temperaturas_por_fecha or {}
    serie['temp'] = serie['fecha'].map(lambda f: temperaturas_por_fecha.get(f, 15.0))

    serie[['lag7', 'lag14', 'lag30']] = serie[['lag7', 'lag14', 'lag30']].fillna(0)
    return serie


def _entrenar_modelo_cuantil(X: pd.DataFrame, y: pd.Series, alpha: float) -> XGBRegressor:
    modelo = XGBRegressor(
        objective='reg:quantileerror',
        quantile_alpha=alpha,
        n_estimators=150,
        max_depth=4,
        learning_rate=0.08,
        random_state=42,
    )
    modelo.fit(X, y)
    return modelo


def entrenar_modelos(serie_features: pd.DataFrame) -> Dict[str, XGBRegressor]:
    """Entrena un XGBRegressor por cuantil (P10/P50/P90)."""
    X = serie_features[FEATURES]
    y = serie_features['pedidos']
    return {nombre: _entrenar_modelo_cuantil(X, y, alpha) for nombre, alpha in QUANTILES.items()}


def predecir_proximos_dias(pedidos: List[Dict], dias: int = 7, temperaturas_futuras: Dict = None) -> List[Dict]:
    """Devuelve una lista de `dias` diccionarios {fecha, p10, p50, p90} con
    el pronóstico de pedidos por día. Lista vacía si no hay historial
    suficiente para entrenar un modelo razonable."""
    serie = construir_serie_diaria(pedidos)
    if len(serie) < MIN_DIAS_ENTRENAMIENTO:
        logger.warning(f"Historial insuficiente para pronóstico: {len(serie)} días (mínimo {MIN_DIAS_ENTRENAMIENTO})")
        return []

    serie_features = agregar_features(serie)
    modelos = entrenar_modelos(serie_features)

    temperaturas_futuras = temperaturas_futuras or {}
    serie_extendida = serie.copy()
    ultima_fecha = pd.to_datetime(serie['fecha'].iloc[-1])
    resultado = []

    for i in range(1, dias + 1):
        fecha_pred = (ultima_fecha + timedelta(days=i)).date()

        # Para calcular los lags del día a predecir se agrega momentáneamente
        # una fila con el promedio reciente como relleno.
        relleno = serie_extendida['pedidos'].tail(7).mean() if len(serie_extendida) else 0
        serie_para_features = pd.concat([
            serie_extendida,
            pd.DataFrame({'fecha': [fecha_pred], 'pedidos': [relleno]})
        ], ignore_index=True)

        features_dia = agregar_features(serie_para_features, temperaturas_futuras).iloc[[-1]]

        pred = {'fecha': str(fecha_pred)}
        for nombre, modelo in modelos.items():
            valor = float(modelo.predict(features_dia[FEATURES])[0])
            pred[nombre] = max(0.0, round(valor, 1))

        # Los tres modelos son independientes y pueden cruzarse levemente;
        # se fuerza el orden p10 <= p50 <= p90.
        p10, p50, p90 = sorted([pred['p10'], pred['p50'], pred['p90']])
        pred['p10'], pred['p50'], pred['p90'] = p10, p50, p90
        resultado.append(pred)

        # Encadenar la predicción: usar la mediana proyectada como "real"
        # para calcular los lags del día siguiente.
        serie_extendida = pd.concat([
            serie_extendida,
            pd.DataFrame({'fecha': [fecha_pred], 'pedidos': [pred['p50']]})
        ], ignore_index=True)

    return resultado
