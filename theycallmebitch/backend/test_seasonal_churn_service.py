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
