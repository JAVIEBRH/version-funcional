from services.customer_profile_service import construir_perfiles_clientes


def _pedido(usuario, fecha, precio=2000, dire='calle 1', telefonou='912345678', nombrelocal='Aguas Ancud'):
    return {
        'usuario': usuario, 'fecha': fecha, 'precio': str(precio),
        'dire': dire, 'telefonou': telefonou, 'nombrelocal': nombrelocal,
    }


def test_usa_el_pedido_mas_reciente_para_contacto_no_el_primero():
    pedidos = [
        _pedido('ana@fluvi.cl', '01-01-2025', dire='direccion vieja', telefonou='111'),
        _pedido('ana@fluvi.cl', '15-06-2026', dire='direccion nueva', telefonou='222'),
    ]
    perfiles = construir_perfiles_clientes(pedidos)
    assert len(perfiles) == 1
    assert perfiles[0]['direccion'] == 'direccion nueva'
    assert perfiles[0]['telefono'] == '222'


def test_pedidos_count_y_total_comprado_son_sumas_reales():
    pedidos = [
        _pedido('ana@fluvi.cl', '01-01-2025', precio=2000),
        _pedido('ana@fluvi.cl', '10-01-2025', precio=3000),
        _pedido('ana@fluvi.cl', '20-01-2025', precio=2500),
    ]
    perfiles = construir_perfiles_clientes(pedidos)
    assert perfiles[0]['pedidos'] == 3
    assert perfiles[0]['total_comprado'] == 7500


def test_primera_compra_y_ultimo_pedido_correctos():
    pedidos = [
        _pedido('ana@fluvi.cl', '01-01-2025'),
        _pedido('ana@fluvi.cl', '20-06-2026'),
        _pedido('ana@fluvi.cl', '15-03-2025'),
    ]
    perfiles = construir_perfiles_clientes(pedidos)
    assert perfiles[0]['primera_compra'] == '01-01-2025'
    assert perfiles[0]['ultimo_pedido'] == '20-06-2026'


def test_filtra_a_aguas_ancud_solamente():
    pedidos = [
        _pedido('ana@fluvi.cl', '01-01-2025', nombrelocal='Aguas Ancud'),
        _pedido('otro@fluvi.cl', '01-01-2025', nombrelocal='Otra Marca'),
    ]
    perfiles = construir_perfiles_clientes(pedidos)
    assert len(perfiles) == 1
    assert perfiles[0]['usuario'] == 'ana@fluvi.cl'


def test_lista_vacia_no_rompe():
    assert construir_perfiles_clientes([]) == []


def test_pedido_sin_usuario_se_ignora():
    pedidos = [_pedido('', '01-01-2025'), _pedido('ana@fluvi.cl', '01-01-2025')]
    perfiles = construir_perfiles_clientes(pedidos)
    assert len(perfiles) == 1
