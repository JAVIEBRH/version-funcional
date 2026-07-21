from datetime import datetime, timedelta
from services.seasonal_churn_service import clasificar_churn_estacional


def _pedido(usuario, fecha_str):
    return {'usuario': usuario, 'fecha': fecha_str, 'nombrelocal': 'Aguas Ancud'}


def test_detecta_patron_estacional_real():
    # Cliente que compra en verano (dic-feb) todos los años, nada el resto — patrón de 2+ años
    pedidos = [
        _pedido('estacional@fluvi.cl', '15-12-2023'), _pedido('estacional@fluvi.cl', '20-01-2024'),
        _pedido('estacional@fluvi.cl', '10-02-2024'), _pedido('estacional@fluvi.cl', '18-12-2024'),
        _pedido('estacional@fluvi.cl', '22-01-2025'), _pedido('estacional@fluvi.cl', '15-02-2025'),
    ]
    clientes_inactivos = [{'usuario': 'estacional@fluvi.cl'}]
    resultado = clasificar_churn_estacional(pedidos, clientes_inactivos)
    assert resultado['clientes'][0]['clasificacion'] == 'estacional'


def test_cliente_sin_historial_suficiente_es_real_por_defecto():
    pedidos = [_pedido('nuevo_inactivo@fluvi.cl', '10-01-2026')]
    clientes_inactivos = [{'usuario': 'nuevo_inactivo@fluvi.cl'}]
    resultado = clasificar_churn_estacional(pedidos, clientes_inactivos)
    assert resultado['clientes'][0]['clasificacion'] == 'real'


def test_lista_vacia_no_rompe():
    assert clasificar_churn_estacional([], []) == {'clientes': []}


def test_coincidencia_de_trimestre_en_anos_viejos_no_recientes_es_real():
    # Historial de 5 años. Solo dos años ANTIGUOS (2020 y 2021) comparten
    # trimestre (ambos con pedido en marzo, Q1). Los dos años MAS RECIENTES
    # (2023 y 2024) no comparten ningún trimestre entre sí. Antes del fix,
    # la coincidencia 2020/2021 (en cualquier par de años) bastaba para
    # marcarlo "estacional" — un falso positivo. Con la nueva regla, solo
    # importan los dos años más recientes, así que debe clasificarse "real".
    pedidos = [
        _pedido('random@fluvi.cl', '10-03-2020'),  # Q1
        _pedido('random@fluvi.cl', '15-03-2021'),  # Q1 (coincide con 2020, pero es historial viejo)
        _pedido('random@fluvi.cl', '05-07-2022'),  # Q2
        _pedido('random@fluvi.cl', '20-01-2023'),  # Q0 (año más reciente -2)
        _pedido('random@fluvi.cl', '12-11-2024'),  # Q3 (año más reciente)
    ]
    clientes_inactivos = [{'usuario': 'random@fluvi.cl'}]
    resultado = clasificar_churn_estacional(pedidos, clientes_inactivos)
    assert resultado['clientes'][0]['clasificacion'] == 'real'
