"""Tests para demand_forecast_service. Usa datos sintéticos deterministas,
no llama a ninguna API externa."""
from datetime import datetime, timedelta
import pytest
from services import demand_forecast_service as dfs


def _pedidos_sinteticos(dias=60, base=5):
    """Genera `dias` días de pedidos sintéticos con un patrón claro:
    más pedidos los fines de semana, para poder verificar que el modelo
    aprende algo sensato."""
    pedidos = []
    inicio = datetime(2026, 1, 1)
    for i in range(dias):
        fecha = inicio + timedelta(days=i)
        es_finde = fecha.weekday() >= 5
        cantidad = base + (3 if es_finde else 0)
        for _ in range(cantidad):
            pedidos.append({
                'fecha': fecha.strftime('%d-%m-%Y'),
                'nombrelocal': 'Aguas Ancud',
                'precio': '4000',
                'usuario': f'cliente{i}@test.cl',
            })
    return pedidos


def test_construir_serie_diaria_cuenta_pedidos_por_dia():
    pedidos = _pedidos_sinteticos(dias=10, base=5)
    serie = dfs.construir_serie_diaria(pedidos)
    assert len(serie) == 10
    assert 'fecha' in serie.columns
    assert 'pedidos' in serie.columns
    assert serie['pedidos'].sum() > 0


def test_construir_serie_diaria_rellena_dias_sin_pedidos_con_cero():
    pedidos = [
        {'fecha': '01-01-2026', 'nombrelocal': 'Aguas Ancud', 'precio': '4000', 'usuario': 'a@test.cl'},
        {'fecha': '05-01-2026', 'nombrelocal': 'Aguas Ancud', 'precio': '4000', 'usuario': 'b@test.cl'},
    ]
    serie = dfs.construir_serie_diaria(pedidos)
    assert len(serie) == 5  # 01-ene a 05-ene inclusive
    assert serie['pedidos'].tolist() == [1, 0, 0, 0, 1]


def test_agregar_features_agrega_columnas_esperadas():
    pedidos = _pedidos_sinteticos(dias=30)
    serie = dfs.construir_serie_diaria(pedidos)
    features = dfs.agregar_features(serie)
    for col in dfs.FEATURES:
        assert col in features.columns
    assert features[dfs.FEATURES].isna().sum().sum() == 0


def test_predecir_proximos_dias_devuelve_rango_ordenado():
    pedidos = _pedidos_sinteticos(dias=60)
    predicciones = dfs.predecir_proximos_dias(pedidos, dias=7)
    assert len(predicciones) == 7
    for dia in predicciones:
        assert dia['p10'] <= dia['p50'] <= dia['p90']
        assert dia['p10'] >= 0


def test_predecir_proximos_dias_con_poco_historial_devuelve_vacio():
    pedidos = _pedidos_sinteticos(dias=5)
    predicciones = dfs.predecir_proximos_dias(pedidos, dias=7)
    assert predicciones == []


def test_validar_precision_devuelve_mape_razonable():
    pedidos = _pedidos_sinteticos(dias=90)
    resultado = dfs.validar_precision(pedidos, dias_test=20)
    assert resultado['dias_evaluados'] > 0
    assert resultado['mape_pct'] is not None
    assert resultado['mape_pct'] >= 0


def test_validar_precision_con_poco_historial_devuelve_none():
    pedidos = _pedidos_sinteticos(dias=20)
    resultado = dfs.validar_precision(pedidos, dias_test=30)
    assert resultado == {'mape_pct': None, 'dias_evaluados': 0}
