"""
Regresión para el hallazgo crítico de code review: las 13 tools nuevas de las
Fases B/C/D no estaban en `_INTENT_TOOLS`, así que cuando `_classify_intent`
detectaba correctamente un intent específico (no "general"), la tool nueva
diseñada exactamente para esa pregunta nunca se ofrecía al modelo.

Estos tests llaman directo a `_classify_intent` + `_get_tools_for_intent`
(sin red, sin OpenAI) con preguntas realistas que deberían enrutar a cada
tool nueva, y verifican que la tool efectivamente esté en la lista devuelta.
"""
from services.ai_engine import _classify_intent, _get_tools_for_intent, NO_CACHE_TOOLS


def _tool_names_for(question: str) -> set:
    intent = _classify_intent(question)
    tools = _get_tools_for_intent(intent)
    return {t["function"]["name"] for t in tools}, intent


def test_pregunta_rentabilidad_enruta_a_financial_e_incluye_tool_nueva():
    names, intent = _tool_names_for("¿Cuál es la rentabilidad del negocio este mes?")
    assert intent == "financial"
    assert "get_rentabilidad_reportes" in names


def test_pregunta_fuga_de_margen_enruta_a_financial_e_incluye_tool_nueva():
    names, intent = _tool_names_for("¿Cómo está la fuga de margen por costos de reparto este mes?")
    assert intent == "financial"
    assert "get_margin_leak_analysis" in names


def test_pregunta_riesgo_de_cliente_enruta_a_rfm_e_incluye_tool_nueva():
    names, intent = _tool_names_for("¿Qué tan urgente es priorizar a este cliente en riesgo antes que los demás?")
    assert intent == "rfm"
    assert "get_customer_risk" in names


def test_pregunta_churn_estacional_enruta_a_rfm_e_incluye_tool_nueva():
    names, intent = _tool_names_for("Este cliente perdido, ¿es churn estacional o se fue de verdad?")
    assert intent == "rfm"
    assert "get_seasonal_churn_classification" in names


def test_pregunta_ruta_enruta_a_zone_e_incluye_tool_nueva():
    names, intent = _tool_names_for("¿Dónde debería concentrar el reparto para aprovechar mejor la ruta?")
    assert intent == "zone"
    assert "get_route_intelligence" in names


def test_pregunta_canales_enruta_a_expansion_e_incluye_tool_nueva():
    names, intent = _tool_names_for("¿El local está compensando la caída del canal delivery?")
    assert intent == "expansion"
    assert "get_channel_comparison" in names


def test_pregunta_demanda_enruta_a_inventory_e_incluye_tool_nueva():
    names, intent = _tool_names_for("¿Cuánta demanda debo esperar para planificar el abastecimiento?")
    assert intent == "inventory"
    assert "get_demand_forecast" in names


def test_todas_las_tools_nuevas_siguen_disponibles_en_intent_general():
    # El fallback "general" ya devolvía TODAS las tools — no debe romperse.
    names, intent = _tool_names_for("cuéntame algo interesante del negocio")
    assert intent == "general"
    nuevas = {
        "get_customer_risk", "get_demand_forecast", "get_rentabilidad_reportes",
        "get_discount_analysis", "get_route_intelligence", "get_growth_opportunities",
        "get_margin_leak_analysis", "get_payment_risk_analysis", "get_channel_comparison",
        "get_sla_compliance", "get_activation_rate", "get_seasonal_churn_classification",
        "web_search",
    }
    assert nuevas.issubset(names)


def test_web_search_no_se_cachea():
    assert "web_search" in NO_CACHE_TOOLS


def test_get_demand_forecast_no_se_cachea():
    assert "get_demand_forecast" in NO_CACHE_TOOLS
