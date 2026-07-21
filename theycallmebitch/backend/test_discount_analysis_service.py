from datetime import datetime, timedelta
from services.discount_analysis_service import analizar_descuento_volumen


def _pedido(usuario, dias_atras, precio, ordenpedido, dire='portezuelo de los azules 100'):
    fecha = (datetime.now() - timedelta(days=dias_atras)).strftime('%d-%m-%Y')
    return {
        'usuario': usuario, 'fecha': fecha, 'precio': str(precio),
        'ordenpedido': str(ordenpedido), 'dire': dire, 'nombrelocal': 'Aguas Ancud',
    }


def test_detecta_pedidos_con_descuento_por_precio_por_bidon():
    # 3 bidones a $5000 = $1667/bidon (con descuento) vs 3 bidones a $6000 = $2000/bidon (normal)
    pedidos = [
        _pedido('a@fluvi.cl', 10, 5000, 3),
        _pedido('b@fluvi.cl', 20, 6000, 3),
    ]
    resultado = analizar_descuento_volumen(pedidos)
    assert len(resultado['zonas_con_descuento']) >= 1
    zona = resultado['zonas_con_descuento'][0]
    assert zona['pedidos_con_descuento'] == 1
    assert zona['pedidos_sin_descuento'] == 1


def test_zona_sin_ningun_pedido_con_descuento_no_aparece():
    pedidos = [_pedido('a@fluvi.cl', 10, 6000, 3, dire='otra calle 123')]
    resultado = analizar_descuento_volumen(pedidos)
    assert resultado['zonas_con_descuento'] == []


def test_lista_vacia_no_rompe():
    assert analizar_descuento_volumen([]) == {'zonas_con_descuento': []}
