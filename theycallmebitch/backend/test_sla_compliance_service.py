from services.sla_compliance_service import calcular_cumplimiento_horario


def _pedido_legacy(fecha, horaagenda, horaentrega, nombrelocal='Aguas Ancud'):
    return {
        'fecha': fecha,
        'horaagenda': horaagenda,
        'horaentrega': horaentrega,
        'nombrelocal': nombrelocal,
    }


def _pedido_nuevo(horaagenda, horaentrega, nombrelocal='Aguas Ancud'):
    return {
        'horaagenda': horaagenda,
        'horaentrega': horaentrega,
        'nombrelocal': nombrelocal,
    }


# --- Legacy range format -----------------------------------------------------

def test_legacy_dentro_del_rango_es_cumplido():
    pedidos = [_pedido_legacy('12-08-2025', '18:00 - 19:00', '18:10')]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 1
    assert resultado['pedidos_evaluados_legacy'] == 1
    assert resultado['pct_cumplimiento'] == 100.0


def test_legacy_fuera_del_rango_no_es_cumplido():
    pedidos = [_pedido_legacy('12-08-2025', '18:00 - 19:00', '19:45')]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 1
    assert resultado['pct_cumplimiento'] == 0.0


def test_legacy_en_los_bordes_del_rango_es_cumplido():
    pedidos = [
        _pedido_legacy('12-08-2025', '18:00 - 19:00', '18:00'),
        _pedido_legacy('12-08-2025', '18:00 - 19:00', '19:00'),
    ]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pct_cumplimiento'] == 100.0


def test_legacy_rango_que_cruzaria_medianoche_se_omite():
    pedidos = [_pedido_legacy('12-08-2025', '23:30 - 00:15', '23:40')]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 0
    assert resultado['pct_cumplimiento'] is None


# --- New point (AM/PM) format -------------------------------------------------

def test_nuevo_dentro_de_tolerancia_es_cumplido():
    # deliveredAt viene en UTC; Chile es UTC-4 en esta conversión (misma
    # convención que data_adapter.py usa para 'createdAt'). 16:20 UTC ==
    # 12:20 local, dentro de la tolerancia de la promesa '12:00 PM' local.
    pedidos = [_pedido_nuevo('12:00 PM', '2025-10-23T16:20:00.000Z')]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 1
    assert resultado['pedidos_evaluados_nuevos'] == 1
    assert resultado['pct_cumplimiento'] == 100.0


def test_nuevo_fuera_de_tolerancia_no_es_cumplido():
    # 18:15 UTC == 14:15 local, 2h15 después de la promesa '12:00 PM' local.
    pedidos = [_pedido_nuevo('12:00 PM', '2025-10-23T18:15:00.000Z')]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 1
    assert resultado['pct_cumplimiento'] == 0.0


def test_nuevo_pm_se_convierte_correctamente_a_24h():
    # 06:00 PM debe interpretarse como 18:00 local, no 06:00.
    # 22:10 UTC == 18:10 local.
    pedidos = [_pedido_nuevo('06:00 PM', '2025-10-23T22:10:00.000Z')]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pct_cumplimiento'] == 100.0


# --- Mixed batch --------------------------------------------------------------

def test_batch_mixto_calcula_pct_combinado():
    pedidos = [
        _pedido_legacy('12-08-2025', '18:00 - 19:00', '18:10'),  # cumplido
        _pedido_legacy('12-08-2025', '10:00 - 11:00', '11:45'),  # no cumplido
        _pedido_nuevo('12:00 PM', '2025-10-23T16:20:00.000Z'),   # cumplido (12:20 local)
        _pedido_nuevo('12:00 PM', '2025-10-23T19:00:00.000Z'),   # no cumplido (15:00 local)
    ]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 4
    assert resultado['pedidos_evaluados_legacy'] == 2
    assert resultado['pedidos_evaluados_nuevos'] == 2
    assert resultado['pedidos_cumplidos'] == 2
    assert resultado['pct_cumplimiento'] == 50.0


# --- Missing / malformed data ---------------------------------------------

def test_pedidos_sin_datos_de_hora_se_ignoran():
    pedidos = [
        _pedido_legacy('12-08-2025', '', ''),
        _pedido_nuevo(None, None),
    ]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 0
    assert resultado['pct_cumplimiento'] is None


def test_legacy_sin_fecha_se_omite():
    pedidos = [_pedido_legacy('', '18:00 - 19:00', '18:10')]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 0


def test_legacy_horaentrega_malformada_no_rompe():
    pedidos = [_pedido_legacy('12-08-2025', '18:00 - 19:00', 'no-es-una-hora')]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 0
    assert resultado['pct_cumplimiento'] is None


def test_nuevo_horaentrega_iso_malformada_no_rompe():
    pedidos = [_pedido_nuevo('12:00 PM', 'no-es-un-iso')]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 0


def test_pedido_sin_campos_no_rompe():
    pedidos = [{}, {'nombrelocal': 'Aguas Ancud'}]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 0
    assert resultado['pct_cumplimiento'] is None


def test_filtra_por_nombrelocal():
    pedidos = [
        _pedido_legacy('12-08-2025', '18:00 - 19:00', '18:10', nombrelocal='Otro Local'),
        _pedido_legacy('12-08-2025', '18:00 - 19:00', '18:10', nombrelocal='Aguas Ancud'),
    ]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 1


# --- Empty list -----------------------------------------------------------

def test_lista_vacia_no_rompe():
    resultado = calcular_cumplimiento_horario([])
    assert resultado['pedidos_evaluados'] == 0
    assert resultado['pct_cumplimiento'] is None
