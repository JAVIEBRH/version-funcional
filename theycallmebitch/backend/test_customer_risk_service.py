"""Tests para customer_risk_service con datos sintéticos deterministas."""
from datetime import datetime, timedelta
import pytest
from services import customer_risk_service as crs


def _pedido(usuario, fecha_dt, precio=4000):
    return {
        'usuario': usuario,
        'fecha': fecha_dt.strftime('%d-%m-%Y'),
        'precio': str(precio),
        'nombrelocal': 'Aguas Ancud',
        'telefonou': '900000000',
        'dire': 'direccion de prueba',
    }


def _pedidos_cliente_regular(usuario, hoy, cada_dias, cantidad, ultima_hace_dias):
    """Genera pedidos de un cliente que compra cada `cada_dias` días,
    terminando `ultima_hace_dias` días atrás."""
    ultima_fecha = hoy - timedelta(days=ultima_hace_dias)
    pedidos = []
    for i in range(cantidad):
        fecha = ultima_fecha - timedelta(days=cada_dias * (cantidad - 1 - i))
        pedidos.append(_pedido(usuario, fecha))
    return pedidos


def test_cliente_al_dia_queda_activo():
    hoy = datetime.now()
    # Compra cada 10 días, su última compra fue hace 3 días -> al día
    pedidos = _pedidos_cliente_regular('activo@test.cl', hoy, cada_dias=10, cantidad=8, ultima_hace_dias=3)
    resultado = crs.calcular_riesgo_clientes(pedidos)
    cliente = next(c for c in resultado['clientes'] if c['usuario'] == 'activo@test.cl')
    assert cliente['estado'] == 'activo'
    assert cliente['dias_atraso'] == 0


def test_cliente_muy_atrasado_queda_inactivo():
    hoy = datetime.now()
    # Compra cada 10 días, pero lleva 90 días sin comprar -> inactivo
    pedidos = _pedidos_cliente_regular('inactivo@test.cl', hoy, cada_dias=10, cantidad=8, ultima_hace_dias=90)
    resultado = crs.calcular_riesgo_clientes(pedidos)
    cliente = next(c for c in resultado['clientes'] if c['usuario'] == 'inactivo@test.cl')
    assert cliente['estado'] == 'inactivo'
    assert cliente['dias_atraso'] > 0


def test_resumen_cuenta_todos_los_clientes():
    hoy = datetime.now()
    pedidos = (
        _pedidos_cliente_regular('a@test.cl', hoy, 10, 8, 3) +
        _pedidos_cliente_regular('b@test.cl', hoy, 10, 8, 90)
    )
    resultado = crs.calcular_riesgo_clientes(pedidos)
    total = resultado['resumen']['activos'] + resultado['resumen']['en_riesgo'] + resultado['resumen']['inactivos']
    assert total == 2


def test_lista_ordenada_por_valor_en_juego_descendente():
    hoy = datetime.now()
    pedidos = (
        _pedidos_cliente_regular('barato_atrasado@test.cl', hoy, 10, 8, 50, ) +
        [_pedido('barato_atrasado@test.cl', hoy - timedelta(days=d)) for d in []]
    )
    # Cliente caro y atrasado
    pedidos_caro = _pedidos_cliente_regular('caro_atrasado@test.cl', hoy, 10, 8, 50)
    pedidos_caro = [dict(p, precio='20000') for p in pedidos_caro]
    pedidos_barato = _pedidos_cliente_regular('barato_atrasado@test.cl', hoy, 10, 8, 50)
    pedidos_barato = [dict(p, precio='2000') for p in pedidos_barato]

    resultado = crs.calcular_riesgo_clientes(pedidos_caro + pedidos_barato)
    usuarios_en_orden = [c['usuario'] for c in resultado['clientes']]
    assert usuarios_en_orden.index('caro_atrasado@test.cl') < usuarios_en_orden.index('barato_atrasado@test.cl')


def test_cliente_con_un_solo_pedido_no_rompe():
    hoy = datetime.now()
    pedidos = [_pedido('unico@test.cl', hoy - timedelta(days=5))]
    resultado = crs.calcular_riesgo_clientes(pedidos)
    cliente = next(c for c in resultado['clientes'] if c['usuario'] == 'unico@test.cl')
    assert cliente['cadencia_personal_dias'] is None


def test_cliente_un_solo_pedido_muy_antiguo_no_queda_activo():
    hoy = datetime.now()
    # Un único pedido histórico, hace mucho más que el umbral 'nuevo' (45 días)
    # -> no puede quedar 'activo' para siempre.
    pedidos = [_pedido('unico_viejo@test.cl', hoy - timedelta(days=200))]
    resultado = crs.calcular_riesgo_clientes(pedidos)
    cliente = next(c for c in resultado['clientes'] if c['usuario'] == 'unico_viejo@test.cl')
    assert cliente['estado'] != 'activo'
    assert cliente['cadencia_personal_dias'] is None


def test_lista_vacia_no_rompe():
    resultado = crs.calcular_riesgo_clientes([])
    assert resultado == {'resumen': {'activos': 0, 'en_riesgo': 0, 'inactivos': 0}, 'clientes': []}
