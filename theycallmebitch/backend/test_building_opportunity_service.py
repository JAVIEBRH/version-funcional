from services.building_opportunity_service import detectar_oportunidad_edificio


def _pedido(usuario, dire, precio=2000):
    return {'usuario': usuario, 'dire': dire, 'precio': str(precio), 'nombrelocal': 'Aguas Ancud'}


def test_detecta_edificio_con_multiples_clientes():
    pedidos = [
        _pedido('a@fluvi.cl', 'depto A block 1, edificio central 100'),
        _pedido('b@fluvi.cl', 'depto B block 1, edificio central 100'),
        _pedido('c@fluvi.cl', 'depto C block 1, edificio central 100'),
        _pedido('d@fluvi.cl', 'otra calle 200'),
    ]
    resultado = detectar_oportunidad_edificio(pedidos)
    assert len(resultado['edificios']) == 1
    assert resultado['edificios'][0]['clientes_distintos'] == 3


def test_direccion_con_pocos_clientes_no_aparece():
    pedidos = [_pedido('a@fluvi.cl', 'calle sola 1'), _pedido('b@fluvi.cl', 'calle sola 1')]
    resultado = detectar_oportunidad_edificio(pedidos)
    assert resultado['edificios'] == []


def test_lista_vacia_no_rompe():
    assert detectar_oportunidad_edificio([]) == {'edificios': []}


def test_maneja_entrada_sin_columna_precio():
    """Regression test for missing-column-as-scalar bug.

    When 'precio' column is missing from input, the service should
    gracefully handle it without crashing on AttributeError.
    """
    pedidos = [
        {'usuario': 'a@fluvi.cl', 'dire': 'block 1, edificio central 100', 'nombrelocal': 'Aguas Ancud'},
        {'usuario': 'b@fluvi.cl', 'dire': 'block 1, edificio central 100', 'nombrelocal': 'Aguas Ancud'},
        {'usuario': 'c@fluvi.cl', 'dire': 'block 1, edificio central 100', 'nombrelocal': 'Aguas Ancud'},
    ]
    # Should not raise AttributeError about 'int' object has no attribute 'fillna'
    resultado = detectar_oportunidad_edificio(pedidos)
    assert len(resultado['edificios']) == 1
    assert resultado['edificios'][0]['clientes_distintos'] == 3
    assert resultado['edificios'][0]['revenue_total'] == 0  # No prices provided
