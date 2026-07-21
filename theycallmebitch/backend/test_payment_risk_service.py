from services.payment_risk_service import analizar_riesgo_pago


def _pedido(metodopago, status='entregado'):
    return {'metodopago': metodopago, 'status': status, 'nombrelocal': 'Aguas Ancud'}


def test_calcula_tasa_de_cancelacion_por_metodo():
    pedidos = [
        _pedido('transferencia', 'entregado'), _pedido('transferencia', 'entregado'),
        _pedido('transferencia', 'cancelado'),
        _pedido('efectivo', 'entregado'), _pedido('efectivo', 'entregado'),
    ]
    resultado = analizar_riesgo_pago(pedidos)
    transferencia = next(m for m in resultado['metodos'] if m['metodo'] == 'transferencia')
    efectivo = next(m for m in resultado['metodos'] if m['metodo'] == 'efectivo')
    assert transferencia['tasa_cancelacion_pct'] > efectivo['tasa_cancelacion_pct']


def test_lista_vacia_no_rompe():
    assert analizar_riesgo_pago([]) == {'metodos': []}
