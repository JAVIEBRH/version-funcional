def test_loop_no_llama_a_openai_si_no_hay_anomalias(monkeypatch):
    from main import _decidir_si_generar_insight
    import services.anomaly_detection_service as ads
    monkeypatch.setattr(ads, "detectar_anomalias", lambda pedidos: [])
    llamo_openai = {"valor": False}
    def fake_run_autonomous_insight(context):
        llamo_openai["valor"] = True
        return []
    resultado = _decidir_si_generar_insight([], fake_run_autonomous_insight, {})
    assert llamo_openai["valor"] is False


def test_loop_llama_a_openai_si_hay_anomalia_real(monkeypatch):
    from main import _decidir_si_generar_insight
    import services.anomaly_detection_service as ads
    monkeypatch.setattr(ads, "detectar_anomalias", lambda pedidos: [{"tipo": "caida_pedidos"}])
    llamo_openai = {"valor": False}
    def fake_run_autonomous_insight(context):
        llamo_openai["valor"] = True
        return []
    _decidir_si_generar_insight([], fake_run_autonomous_insight, {})
    assert llamo_openai["valor"] is True
