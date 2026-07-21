import json
import os
from unittest.mock import patch

from services.ai_engine import (
    _execute_tool,
    run_chat_query,
    run_chat_query_prepare,
    run_chat_query_with_rec_id,
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


def test_get_customer_risk_devuelve_estructura_real():
    resultado = _execute_tool("get_customer_risk", {}, [], {})
    assert "resumen" in resultado
    assert "clientes" in resultado
    assert set(resultado["resumen"].keys()) == {"activos", "en_riesgo", "inactivos"}


def test_get_demand_forecast_devuelve_pronostico_y_precision():
    resultado = _execute_tool("get_demand_forecast", {}, [], {})
    assert "pronostico" in resultado
    assert "precision_historica" in resultado
