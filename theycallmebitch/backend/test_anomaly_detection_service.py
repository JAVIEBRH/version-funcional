from datetime import datetime, timedelta
from services.anomaly_detection_service import detectar_anomalias


def _pedidos_serie(conteos_por_dia):
    pedidos = []
    hoy = datetime.now()
    for i, conteo in enumerate(conteos_por_dia):
        fecha = (hoy - timedelta(days=len(conteos_por_dia) - i)).strftime('%d-%m-%Y')
        for _ in range(conteo):
            pedidos.append({'fecha': fecha, 'nombrelocal': 'Aguas Ancud', 'usuario': 'x@fluvi.cl', 'precio': '2000'})
    return pedidos


def test_detecta_caida_real_de_pedidos():
    # 20 días con ~10 pedidos/día, último día con 1
    conteos = [10, 11, 9, 10, 12, 9, 10, 11, 9, 10, 12, 9, 10, 11, 9, 10, 12, 9, 10, 11] + [1]
    resultado = detectar_anomalias(_pedidos_serie(conteos))
    assert any(a['tipo'] == 'caida_pedidos' for a in resultado)


def test_no_detecta_nada_si_el_patron_es_normal():
    conteos = [10, 11, 9, 10, 12, 9, 10] * 4
    resultado = detectar_anomalias(_pedidos_serie(conteos))
    assert resultado == []


def test_historial_insuficiente_no_rompe():
    assert detectar_anomalias(_pedidos_serie([5, 5, 5])) == []
