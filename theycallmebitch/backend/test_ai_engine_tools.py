from services.ai_engine import _execute_tool


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
