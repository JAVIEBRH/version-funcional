from datetime import datetime, timedelta
from services.opportunity_service import detectar_oportunidades_crecimiento


def _pedido(usuario, dias_atras, precio=2000):
    fecha = (datetime.now() - timedelta(days=dias_atras)).strftime('%d-%m-%Y')
    return {'usuario': usuario, 'fecha': fecha, 'precio': str(precio), 'nombrelocal': 'Aguas Ancud'}


def test_detecta_cliente_que_acelero_su_compra():
    # Históricamente cada 30 días, últimos 60 días cada 10 días
    pedidos = [
        _pedido('ana@fluvi.cl', 200), _pedido('ana@fluvi.cl', 170), _pedido('ana@fluvi.cl', 140),
        _pedido('ana@fluvi.cl', 50), _pedido('ana@fluvi.cl', 40), _pedido('ana@fluvi.cl', 30), _pedido('ana@fluvi.cl', 20),
    ]
    resultado = detectar_oportunidades_crecimiento(pedidos)
    assert len(resultado['clientes']) == 1
    assert resultado['clientes'][0]['usuario'] == 'ana@fluvi.cl'
    assert resultado['clientes'][0]['crecimiento_pct'] > 0


def test_cliente_con_cadencia_estable_no_aparece():
    pedidos = [_pedido('bruno@fluvi.cl', d) for d in [180, 150, 120, 90, 60, 30]]
    resultado = detectar_oportunidades_crecimiento(pedidos)
    assert resultado['clientes'] == []


def test_lista_vacia_no_rompe():
    assert detectar_oportunidades_crecimiento([]) == {'clientes': []}
