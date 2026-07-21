from services.route_intelligence_service import analizar_densidad_geografica


def _pedido(dire, lat=None, lon=None):
    return {'dire': dire, 'nombrelocal': 'Aguas Ancud'}


def test_agrupa_pedidos_por_celda_geografica(monkeypatch):
    from services import route_intelligence_service as ris

    def fake_geocodificar(direccion):
        coords = {
            'calle a 1': {'lat': -33.5501, 'lon': -70.5601},
            'calle a 2': {'lat': -33.5502, 'lon': -70.5602},
            'calle b 1': {'lat': -33.6001, 'lon': -70.6001},
        }
        return coords.get(direccion)

    monkeypatch.setattr(ris, "geocodificar_desde_cache", fake_geocodificar)

    pedidos = [_pedido('calle a 1'), _pedido('calle a 1'), _pedido('calle a 2'), _pedido('calle b 1')]
    resultado = analizar_densidad_geografica(pedidos)
    assert len(resultado['celdas']) >= 1
    assert resultado['celdas'][0]['pedidos'] >= 2


def test_pedidos_sin_direccion_geocodificable_se_ignoran(monkeypatch):
    from services import route_intelligence_service as ris
    monkeypatch.setattr(ris, "geocodificar_desde_cache", lambda d: None)
    resultado = analizar_densidad_geografica([_pedido('sin geocodificar')])
    assert resultado['celdas'] == []


def test_lista_vacia_no_rompe():
    assert analizar_densidad_geografica([]) == {'celdas': []}
