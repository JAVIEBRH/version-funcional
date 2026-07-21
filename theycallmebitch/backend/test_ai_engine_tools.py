import os
from unittest.mock import patch

from services.ai_engine import _execute_tool, run_chat_query


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
