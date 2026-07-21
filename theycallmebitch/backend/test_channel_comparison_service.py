from datetime import datetime, timedelta
from services.channel_comparison_service import comparar_canales


def _pedido(dias_atras, retirolocal, precio=2000):
    fecha = (datetime.now() - timedelta(days=dias_atras)).strftime('%d-%m-%Y')
    return {'fecha': fecha, 'retirolocal': retirolocal, 'precio': str(precio), 'nombrelocal': 'Aguas Ancud'}


def test_compara_ambos_canales_periodo_actual_vs_anterior():
    pedidos = (
        [_pedido(10, 'si') for _ in range(5)] + [_pedido(40, 'si') for _ in range(10)] +
        [_pedido(10, 'no') for _ in range(20)] + [_pedido(40, 'no') for _ in range(20)]
    )
    resultado = comparar_canales(pedidos)
    assert resultado['local']['pedidos_30d'] == 5
    assert resultado['delivery']['pedidos_30d'] == 20


def test_lista_vacia_no_rompe():
    resultado = comparar_canales([])
    assert resultado['local']['pedidos_30d'] == 0
    assert resultado['delivery']['pedidos_30d'] == 0


def test_sin_columna_retirolocal_no_rompe():
    """Regresión: ordenes sin columna 'retirolocal' no deben causar crash."""
    pedidos = [
        {'fecha': (datetime.now() - timedelta(days=10)).strftime('%d-%m-%Y'), 'precio': '2000', 'nombrelocal': 'Aguas Ancud'},
        {'fecha': (datetime.now() - timedelta(days=10)).strftime('%d-%m-%Y'), 'precio': '3000', 'nombrelocal': 'Aguas Ancud'},
        {'fecha': (datetime.now() - timedelta(days=40)).strftime('%d-%m-%Y'), 'precio': '1500', 'nombrelocal': 'Aguas Ancud'},
    ]
    resultado = comparar_canales(pedidos)
    # Without 'retirolocal' column, all orders should be treated as delivery (not local)
    assert resultado['local']['pedidos_30d'] == 0
    assert resultado['delivery']['pedidos_30d'] == 2
    assert resultado['delivery']['revenue_periodo_anterior'] == 1500
