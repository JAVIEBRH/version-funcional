import json
import os
from unittest.mock import patch

from datetime import datetime, timedelta

from services.ai_engine import (
    _execute_tool,
    run_chat_query,
    run_chat_query_prepare,
    run_chat_query_with_rec_id,
    simulate_scenario,
)


def _mock_tool_call(call_id, name, arguments: dict):
    return type("obj", (), {
        "id": call_id,
        "function": type("obj", (), {
            "name": name,
            "arguments": json.dumps(arguments),
        })(),
    })()


def _mock_choice(finish_reason, content=None, tool_calls=None):
    return type("obj", (), {
        "finish_reason": finish_reason,
        "message": type("obj", (), {"content": content, "tool_calls": tool_calls})(),
    })()


def test_get_daily_cashflow_no_hace_llamada_http():
    """No debe intentar conectarse a localhost:8000 ni a ningún host externo —
    debe llamar la función de main.py directamente."""
    resultado = _execute_tool("get_daily_cashflow", {}, [], {})
    assert "error" not in resultado or "Connection" not in str(resultado.get("error", ""))
    assert "ventas_hoy" in resultado


def test_get_inventory_no_hace_llamada_http():
    resultado = _execute_tool("get_inventory", {}, [], {})
    assert "error" not in resultado or "Connection" not in str(resultado.get("error", ""))
    assert "stock_actual" in resultado


def test_run_chat_query_devuelve_error_estructurado_si_openai_falla():
    with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), \
         patch("services.ai_engine.OpenAI") as MockOpenAI:
        MockOpenAI.return_value.chat.completions.create.side_effect = Exception("Rate limit reached")
        resultado = run_chat_query({}, "¿cómo van las ventas?", history=[], pedidos_cache=[])
        assert isinstance(resultado, dict)
        assert resultado.get("error") is True
        assert "Rate limit" not in resultado.get("mensaje", "")


def test_run_chat_query_respuesta_exitosa_sigue_siendo_string():
    with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), \
         patch("services.ai_engine.OpenAI") as MockOpenAI:
        mock_choice = type("obj", (), {
            "finish_reason": "stop",
            "message": type("obj", (), {"content": "Tus ventas van bien.", "tool_calls": None})(),
        })()
        MockOpenAI.return_value.chat.completions.create.return_value.choices = [mock_choice]
        resultado = run_chat_query({}, "¿cómo van las ventas?", history=[], pedidos_cache=[])
        assert isinstance(resultado, str)
        assert resultado == "Tus ventas van bien."


# ─── Task 4: propagación de rec_id ─────────────────────────────────────────

def _mock_response(choice):
    return type("obj", (), {"choices": [choice]})()


def test_run_chat_query_with_rec_id_propaga_id_real_de_draft_campaign_message():
    """Cuando el modelo llama a draft_campaign_message y guardar_recomendacion
    persiste un id real, ese id debe salir en la tupla de retorno."""
    tool_call = _mock_tool_call(
        "call_1", "draft_campaign_message",
        {"segment": "en_riesgo", "offer": "10% descuento"},
    )
    resp_tool_calls = _mock_response(_mock_choice("tool_calls", content=None, tool_calls=[tool_call]))
    resp_stop = _mock_response(_mock_choice("stop", content="Mensaje listo para enviar."))

    with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), \
         patch("services.ai_engine.OpenAI") as MockOpenAI, \
         patch("services.memory_service.guardar_recomendacion", return_value=42) as mock_guardar:
        MockOpenAI.return_value.chat.completions.create.side_effect = [resp_tool_calls, resp_stop]

        respuesta, rec_id = run_chat_query_with_rec_id(
            {}, "redacta un mensaje de campaña", history=[], pedidos_cache=[]
        )

        assert respuesta == "Mensaje listo para enviar."
        assert rec_id == 42
        mock_guardar.assert_called_once()


def test_run_chat_query_with_rec_id_es_none_sin_recomendacion():
    """Si no se usa draft_campaign_message/simulate_scenario, rec_id debe ser None."""
    resp_stop = _mock_response(_mock_choice("stop", content="Tus ventas van bien."))

    with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), \
         patch("services.ai_engine.OpenAI") as MockOpenAI:
        MockOpenAI.return_value.chat.completions.create.return_value = resp_stop

        respuesta, rec_id = run_chat_query_with_rec_id(
            {}, "¿cómo van las ventas?", history=[], pedidos_cache=[]
        )

        assert respuesta == "Tus ventas van bien."
        assert rec_id is None


def test_run_chat_query_sigue_descartando_rec_id_para_no_romper_contrato_task2():
    """run_chat_query (contrato de Task 2) debe seguir devolviendo solo str,
    incluso cuando internamente se generó un rec_id real."""
    tool_call = _mock_tool_call(
        "call_1", "simulate_scenario",
        {"action": "price_change", "params": {"new_price": 2200}},
    )
    resp_tool_calls = _mock_response(_mock_choice("tool_calls", content=None, tool_calls=[tool_call]))
    resp_stop = _mock_response(_mock_choice("stop", content="Simulación completa."))

    with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), \
         patch("services.ai_engine.OpenAI") as MockOpenAI, \
         patch("services.memory_service.guardar_recomendacion", return_value=7):
        MockOpenAI.return_value.chat.completions.create.side_effect = [resp_tool_calls, resp_stop]

        resultado = run_chat_query({}, "qué pasa si subo el precio", history=[], pedidos_cache=[])

        assert isinstance(resultado, str)
        assert resultado == "Simulación completa."


def test_run_chat_query_prepare_devuelve_tupla_de_3_con_rec_id():
    """run_chat_query_prepare (usado por /chat/stream) debe devolver
    (conversation, tools_used, rec_id) — rec_id real cuando se generó una
    recomendación durante la fase de resolución de tools."""
    tool_call = _mock_tool_call(
        "call_1", "draft_campaign_message",
        {"segment": "perdido", "offer": "bidón gratis"},
    )
    resp_tool_calls = _mock_response(_mock_choice("tool_calls", content=None, tool_calls=[tool_call]))
    resp_stop = _mock_response(_mock_choice("stop", content=None))

    with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), \
         patch("services.ai_engine.OpenAI") as MockOpenAI, \
         patch("services.memory_service.guardar_recomendacion", return_value=99):
        MockOpenAI.return_value.chat.completions.create.side_effect = [resp_tool_calls, resp_stop]

        conversation, tools_used, rec_id = run_chat_query_prepare(
            {}, "redacta un mensaje para clientes perdidos", history=[], pedidos_cache=[]
        )

        assert "draft_campaign_message" in tools_used
        assert rec_id == 99
        assert isinstance(conversation, list)


def test_web_search_tool_devuelve_resultado_estructurado():
    from services.ai_engine import _execute_tool
    with patch("services.ai_engine._buscar_web") as mock_buscar:
        mock_buscar.return_value = {"resultado": "Precio de la competencia: $2200/bidón", "fuentes": ["https://ejemplo.cl"]}
        resultado = _execute_tool("web_search", {"query": "precio bidones agua Puente Alto"}, [], {})
        assert "resultado" in resultado
        assert "fuentes" in resultado
        mock_buscar.assert_called_once_with("precio bidones agua Puente Alto")


def test_get_customer_risk_devuelve_estructura_real():
    resultado = _execute_tool("get_customer_risk", {}, [], {})
    assert "resumen" in resultado
    assert "clientes" in resultado
    assert set(resultado["resumen"].keys()) == {"activos", "en_riesgo", "inactivos"}


def test_get_demand_forecast_devuelve_pronostico_y_precision():
    resultado = _execute_tool("get_demand_forecast", {}, [], {})
    assert "pronostico" in resultado
    assert "precision_historica" in resultado


def test_get_rentabilidad_reportes_devuelve_ambos_bloques():
    resultado = _execute_tool("get_rentabilidad_reportes", {}, [], {})
    assert "rentabilidad" in resultado
    assert "reporte_ejecutivo" in resultado


def test_get_discount_analysis_no_hace_llamada_http():
    """get_discount_analysis debe importar y llamar analizar_descuento_volumen
    directamente, no hacer un round-trip HTTP a su propio servidor."""
    resultado = _execute_tool("get_discount_analysis", {}, [], {})
    assert resultado == {"zonas_con_descuento": []}


def _pedido_portezuelo(usuario, dias_atras, precio, ordenpedido):
    fecha = (datetime.now() - timedelta(days=dias_atras)).strftime('%d-%m-%Y')
    return {
        'usuario': usuario, 'fecha': fecha, 'precio': str(precio),
        'ordenpedido': str(ordenpedido), 'dire': 'portezuelo de los azules 100',
        'nombrelocal': 'Aguas Ancud',
    }


def test_simulate_scenario_price_change_sin_datos_de_elasticidad_no_inventa_numero():
    """Sin pedidos_cache (o sin ninguna zona con descuento detectable), price_change
    ya no debe caer de vuelta a un ELASTICITY=-0.3 inventado: debe decir explícitamente
    que no hay datos suficientes."""
    resultado = simulate_scenario(
        "price_change", {"new_price": 2200},
        {"total_bidones_mes": 500, "pedidos_cache": []},
    )
    assert resultado["recomendacion"] == "datos_insuficientes"
    assert resultado["elasticidad_estimada"] is None
    assert "no hay datos suficientes para estimar elasticidad real" in resultado["interpretacion"].lower()
    assert "bidones_proyectados" not in resultado


def test_simulate_scenario_price_change_usa_elasticidad_real_calculada():
    """Con pedidos reales con y sin descuento por volumen en una zona conocida
    (Portezuelo), price_change debe usar la elasticidad real calculada por
    discount_analysis_service en vez de una constante fija."""
    pedidos = [
        _pedido_portezuelo('a@fluvi.cl', 5, 5000, 3),
        _pedido_portezuelo('a@fluvi.cl', 25, 5000, 3),
        _pedido_portezuelo('b@fluvi.cl', 10, 6000, 3),
        _pedido_portezuelo('b@fluvi.cl', 40, 6000, 3),
    ]
    resultado = simulate_scenario(
        "price_change", {"new_price": 2200},
        {"total_bidones_mes": 500, "pedidos_cache": pedidos},
    )
    assert resultado["recomendacion"] in ("viable", "riesgo_churn_alto")
    assert resultado["elasticidad_estimada"] is not None
    assert "bidones_proyectados" in resultado
    assert "elasticidad real" in resultado["interpretacion"].lower()


def test_simulate_scenario_compuesto_suma_impactos():
    """'compound' debe correr cada sub-escenario reusando simulate_scenario
    recursivamente (misma firma de 3 parámetros), devolver un desglose con
    un resultado por sub-escenario, y sumar el campo de impacto económico
    mensual real de cada uno (revenue_mensual_recuperado para
    reactivate_clients, revenue_extra_mensual para increase_frequency) en
    impacto_total."""
    context = {
        "ventas_mensuales": 1000000,
        "pedidos_mensuales": 200,
        "clientes_en_riesgo_count": 50,
        "revenue_en_riesgo": 500000,
        "total_bidones_mes": 300,
    }
    resultado = simulate_scenario("compound", {
        "escenarios": [
            {"action": "reactivate_clients", "params": {"pct_reactivated": 0.2}},
            {"action": "increase_frequency", "params": {"extra_orders_per_client": 1, "affected_clients": 10}},
        ]
    }, context)

    assert "desglose" in resultado
    assert len(resultado["desglose"]) == 2
    assert "impacto_total" in resultado

    # Verificar que el desglose reutiliza los resultados reales de cada acción individual.
    esperado_reactivar = simulate_scenario(
        "reactivate_clients", {"pct_reactivated": 0.2}, context
    )
    esperado_frecuencia = simulate_scenario(
        "increase_frequency",
        {"extra_orders_per_client": 1, "affected_clients": 10},
        context,
    )
    impacto_esperado = (
        esperado_reactivar["revenue_mensual_recuperado"]
        + esperado_frecuencia["revenue_extra_mensual"]
    )
    assert resultado["impacto_total"] == impacto_esperado
    assert resultado["desglose"][0]["resultado"]["revenue_mensual_recuperado"] == (
        esperado_reactivar["revenue_mensual_recuperado"]
    )
    assert resultado["desglose"][1]["resultado"]["revenue_extra_mensual"] == (
        esperado_frecuencia["revenue_extra_mensual"]
    )
