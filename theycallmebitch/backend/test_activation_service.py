from datetime import datetime, timedelta
from services.activation_service import calcular_tasa_activacion


def _pedido(usuario, dias_atras, precio=2000):
    fecha = (datetime.now() - timedelta(days=dias_atras)).strftime('%d-%m-%Y')
    return {'usuario': usuario, 'fecha': fecha, 'precio': str(precio), 'nombrelocal': 'Aguas Ancud'}


def test_calcula_tasa_de_segunda_compra():
    pedidos = (
        [_pedido('activado@fluvi.cl', 90), _pedido('activado@fluvi.cl', 75)] +  # segunda compra a los 15 días
        [_pedido('no_activado@fluvi.cl', 90)]  # nunca volvió
    )
    resultado = calcular_tasa_activacion(pedidos, ventana_dias=30)
    assert resultado['clientes_evaluados'] == 2
    assert resultado['clientes_activados'] == 1
    assert resultado['tasa_activacion_pct'] == 50.0


def test_cliente_muy_reciente_no_se_evalua_todavia():
    # primera compra hace 5 días, ventana de 30 — no le ha dado tiempo, se excluye
    pedidos = [_pedido('nuevo@fluvi.cl', 5)]
    resultado = calcular_tasa_activacion(pedidos, ventana_dias=30)
    assert resultado['clientes_evaluados'] == 0


def test_lista_vacia_no_rompe():
    resultado = calcular_tasa_activacion([], ventana_dias=30)
    assert resultado['tasa_activacion_pct'] is None
