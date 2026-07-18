from datetime import datetime, timedelta

from services.rfm_engine import calcular_rfm


def _pedido(usuario, dias_atras, precio=2000, nombrelocal='Aguas Ancud'):
    fecha = (datetime.now() - timedelta(days=dias_atras)).strftime('%d-%m-%Y')
    return {'usuario': usuario, 'fecha': fecha, 'precio': str(precio), 'nombrelocal': nombrelocal}


def test_segmento_por_cliente_cubre_a_todos_no_solo_el_top_10():
    pedidos = []
    # 15 clientes distintos, cada uno con varios pedidos recientes -> ninguno debería quedar fuera del mapa.
    for i in range(15):
        usuario = f'cliente{i}@fluvi.cl'
        for dias in (5, 20, 35):
            pedidos.append(_pedido(usuario, dias))

    resultado = calcular_rfm(pedidos)

    assert 'segmento_por_cliente' in resultado
    assert len(resultado['segmento_por_cliente']) == 15
    for i in range(15):
        usuario = f'cliente{i}@fluvi.cl'
        assert usuario in resultado['segmento_por_cliente']
        assert resultado['segmento_por_cliente'][usuario] in {
            'campeon', 'leal', 'potencial_leal', 'nuevo',
            'prometedor', 'necesita_atencion', 'en_riesgo', 'perdido',
        }


def test_segmento_por_cliente_vacio_si_no_hay_pedidos():
    resultado = calcular_rfm([])
    assert resultado['segmento_por_cliente'] == {}


def test_rfm_sigue_devolviendo_los_mismos_campos_de_siempre():
    pedidos = [_pedido('a@fluvi.cl', 5), _pedido('a@fluvi.cl', 20)]
    resultado = calcular_rfm(pedidos)
    for campo in (
        'total_clientes', 'clientes_en_riesgo_count', 'revenue_en_riesgo',
        'clientes_perdidos_count', 'revenue_perdido_historico',
        'ticket_promedio_global', 'resumen_segmentos', 'clientes_en_riesgo',
        'clientes_campeon',
    ):
        assert campo in resultado
