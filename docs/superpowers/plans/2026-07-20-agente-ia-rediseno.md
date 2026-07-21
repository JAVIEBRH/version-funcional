# Rediseño del Agente de IA (CEO Virtual) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los bugs que comprometen la confianza en el chat "CEO Virtual" (puerto hardcodeado, errores expuestos crudos, ubicación inconsistente, feedback roto, constante inventada), conectar motores reales ya existentes, construir 11 análisis nuevos con cálculo real, agregar búsqueda web y trazabilidad, y absorber el panel "Modo CEO-Dios" dentro del chat.

**Architecture:** Cada capacidad nueva es una tool más en el patrón `TOOLS`/`_execute_tool` que ya usa `ai_engine.py`. Cada análisis nuevo vive en su propio `services/*.py`, mismo patrón que `customer_risk_service.py`/`customer_profile_service.py`/`demand_forecast_service.py` ya construidos esta sesión — función pura, sin mocks, con tests reales. Ningún tool inventa un número: todo sale de una función calculable y verificable.

**Tech Stack:** FastAPI, pandas, OpenAI Python SDK 2.30.0 (Chat Completions + Responses API para búsqueda web), React + MUI.

## Global Constraints

- **Principio rector**: todo consejo del agente sale de cálculo real sobre datos reales — nunca de estimación del modelo. Cada tool nueva debe ser una función Python pura y testeable, igual que `simulate_scenario` ya lo es hoy.
- Todo pedido se filtra a `nombrelocal == 'aguas ancud'` (case-insensitive, trim) antes de calcular — mismo criterio que el resto del sistema.
- Los servicios nuevos siguen el patrón ya establecido: `_parsear_fecha` acepta `DD-MM-YYYY` y `YYYY-MM-DD`; agrupar por `usuario` (no por dirección) para "cliente", salvo que la tarea diga explícitamente lo contrario (ej. `building_opportunity_service`, que agrupa por dirección a propósito).
- Ninguna tool nueva llama a su propio servidor por HTTP — importan y llaman funciones Python directamente (lazy import dentro de la rama del `if name == "..."`, mismo patrón que ya usan `get_zone_analysis`/`get_customer_segments` en `_execute_tool`).
- No modificar el comportamiento de `customer_risk_service.py`, `rfm_engine.py`, `demand_forecast_service.py`, `customer_profile_service.py`, `zone_engine.py` — solo se llaman desde las tools nuevas.
- No se toca `simulate_scenario`'s firma pública (`action`, `params`, `context_data`) al extenderla — solo se agregan nuevos valores válidos a `action`.
- No construir: recomendador de mayoristas (pospuesto), rendimiento general de repartidor (descartado, solo SLA de horario), reconstrucción de inventario con widget manual (pospuesto — solo se corrige el puerto), ejecución automática de acciones (pospuesto).

---

## Fase A — Correcciones de base

### Task 1: Arreglar `get_daily_cashflow`/`get_inventory` (dejar de auto-llamarse por HTTP)

**Files:**
- Modify: `theycallmebitch/backend/services/ai_engine.py:913-929`

**Interfaces:**
- Consumes: `main.get_ventas_diarias()` y `main.get_estado_inventario()` — funciones síncronas ya existentes en `main.py` (líneas 1278 y 1650), sin parámetros de request.
- Produces: mismo formato de retorno de siempre para estas dos tools — no cambia el contrato con el modelo, solo cómo se obtiene el dato.

- [ ] **Step 1: Escribir el test que falla**

Crear `theycallmebitch/backend/test_ai_engine_tools.py` (nuevo archivo, primer test de este módulo):

```python
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
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd theycallmebitch/backend && python -m pytest test_ai_engine_tools.py -v`
Expected: FAIL — el resultado hoy contiene `{"error": "..."}` con un mensaje de conexión rechazada (no hay nada corriendo en `localhost:8000`).

- [ ] **Step 3: Reemplazar las dos ramas en `_execute_tool`**

En `theycallmebitch/backend/services/ai_engine.py`, reemplazar:

```python
        if name == "get_daily_cashflow":
            try:
                import requests as _req
                base = os.getenv("INTERNAL_API_URL", "http://localhost:8000")
                r = _req.get(f"{base}/ventas-diarias", timeout=5)
                return r.json() if r.ok else {"error": "No se pudo obtener ventas diarias"}
            except Exception as e:
                return {"error": str(e)}

        if name == "get_inventory":
            try:
                import requests as _req
                base = os.getenv("INTERNAL_API_URL", "http://localhost:8000")
                r = _req.get(f"{base}/inventario/estado", timeout=5)
                return r.json() if r.ok else {"error": "Inventario no disponible"}
            except Exception as e:
                return {"error": str(e)}
```

por:

```python
        if name == "get_daily_cashflow":
            try:
                from main import get_ventas_diarias
                return get_ventas_diarias()
            except Exception as e:
                logger.error(f"Error en get_daily_cashflow: {e}")
                return {"error": "No se pudo obtener ventas diarias"}

        if name == "get_inventory":
            try:
                from main import get_estado_inventario
                return get_estado_inventario()
            except Exception as e:
                logger.error(f"Error en get_inventory: {e}")
                return {"error": "Inventario no disponible"}
```

El import es intencionalmente perezoso (dentro de la rama, no al inicio del archivo): `main.py` importa `services.ai_engine` en su nivel superior, así que un import a nivel de módulo de `ai_engine.py` hacia `main.py` crearía un ciclo. Ejecutado dentro de la función, en tiempo de request (mucho después de que ambos módulos ya terminaron de cargar), no hay ciclo — es el mismo patrón que ya usan `get_zone_analysis`/`get_customer_segments`/`get_trends` en este mismo archivo, solo que importando desde `main` en vez de `services.*`.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd theycallmebitch/backend && python -m pytest test_ai_engine_tools.py -v`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add theycallmebitch/backend/services/ai_engine.py theycallmebitch/backend/test_ai_engine_tools.py
git commit -m "fix: get_daily_cashflow/get_inventory call main.py functions directly instead of HTTP self-call to a hardcoded port"
```

---

### Task 2: Errores estructurados (3 puntos: ai_engine, main.py, ChatAssistant fallback)

**Files:**
- Modify: `theycallmebitch/backend/services/ai_engine.py:1020-1022` (dentro de `run_chat_query`)
- Modify: `theycallmebitch/backend/main.py:781-800` (`/chat`)
- Modify: `theycallmebitch/frontend/src/components/ChatAssistant.jsx:250-262` (fallback no-streaming)

**Interfaces:**
- Produces: cuando OpenAI falla, `run_chat_query` devuelve un dict `{"error": True, "mensaje": "..."}` en vez de un string crudo. `/chat` propaga ese dict tal cual bajo la clave `response` (el frontend ya sabe distinguir por la forma del valor). El fallback de `ChatAssistant.jsx` chequea si `data.response` es un objeto con `error: true` antes de renderizarlo como texto.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `theycallmebitch/backend/test_ai_engine_tools.py`:

```python
from unittest.mock import patch
from services.ai_engine import run_chat_query


def test_run_chat_query_devuelve_error_estructurado_si_openai_falla():
    with patch("services.ai_engine.OpenAI") as MockOpenAI:
        MockOpenAI.return_value.chat.completions.create.side_effect = Exception("Rate limit reached")
        resultado = run_chat_query({}, "¿cómo van las ventas?", history=[], pedidos_cache=[])
        assert isinstance(resultado, dict)
        assert resultado.get("error") is True
        assert "Rate limit" not in resultado.get("mensaje", "")
```

Nota: el test verifica que el mensaje de error **no** contenga el texto crudo de la excepción — el mensaje debe ser genérico y honesto ("No pude conectarme con el servicio de análisis, intenta de nuevo"), no la excepción de OpenAI reenviada.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd theycallmebitch/backend && python -m pytest test_ai_engine_tools.py::test_run_chat_query_devuelve_error_estructurado_si_openai_falla -v`
Expected: FAIL — hoy `run_chat_query` devuelve un string (`"Rate limit reached"`), no un dict.

- [ ] **Step 3: Corregir `ai_engine.py`**

Buscar (dentro de `run_chat_query`, cerca de la línea 1020):

```python
        except Exception as e:
            logger.error(f"Error OpenAI en chat: {e}")
            return str(e)
```

Reemplazar por:

```python
        except Exception as e:
            logger.error(f"Error OpenAI en chat: {e}")
            return {"error": True, "mensaje": "No pude conectarme con el servicio de análisis. Intenta de nuevo en un momento."}
```

Buscar todos los demás `return` de `run_chat_query` que devuelven un string (la respuesta final normal) y confirmar que siguen devolviendo string — solo el camino de error cambia de forma. Esto significa que el tipo de retorno de `run_chat_query` pasa a ser `Union[str, dict]` — documentarlo en el docstring de la función.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd theycallmebitch/backend && python -m pytest test_ai_engine_tools.py -v`
Expected: PASS (4/4 — los 2 de Task 1 más los 2 nuevos, ya que hay que agregar también un test de que la respuesta exitosa sigue siendo string, ver Step 3bis abajo).

- [ ] **Step 3bis: Agregar test de no-regresión**

Agregar a `test_ai_engine_tools.py`:

```python
def test_run_chat_query_respuesta_exitosa_sigue_siendo_string():
    with patch("services.ai_engine.OpenAI") as MockOpenAI:
        mock_choice = type("obj", (), {
            "finish_reason": "stop",
            "message": type("obj", (), {"content": "Tus ventas van bien.", "tool_calls": None})(),
        })()
        MockOpenAI.return_value.chat.completions.create.return_value.choices = [mock_choice]
        resultado = run_chat_query({}, "¿cómo van las ventas?", history=[], pedidos_cache=[])
        assert isinstance(resultado, str)
        assert resultado == "Tus ventas van bien."
```

Correr de nuevo: `python -m pytest test_ai_engine_tools.py -v` — debe dar 5/5 (3 de Task 1+2 combinados hasta ahora, más este).

- [ ] **Step 5: Corregir `main.py`'s `/chat`**

En `theycallmebitch/backend/main.py`, dentro de `chat_with_agent` (línea ~788), después de `respuesta = run_chat_query(...)`, no hace falta cambiar nada más en esta ruta — `respuesta` ya puede ser dict o string, y `return {"response": respuesta}` ya lo envuelve correctamente en ambos casos porque FastAPI serializa cualquiera de los dos. Verificar que el `except Exception as e` externo (línea 798-800) también devuelva la misma forma:

Buscar:
```python
    except Exception as e:
        logger.error(f"Error en /chat: {e}")
        return {"response": f"Error procesando consulta: {str(e)}"}
```

Reemplazar por:

```python
    except Exception as e:
        logger.error(f"Error en /chat: {e}")
        return {"response": {"error": True, "mensaje": "No pude procesar tu consulta. Intenta de nuevo."}}
```

- [ ] **Step 6: Corregir el fallback de `ChatAssistant.jsx`**

Buscar (cerca de la línea 259):

```javascript
        const data = await res2.json();
        setMessages(prev => [...prev, { role: 'agent', content: data.response }]);
```

Reemplazar por:

```javascript
        const data = await res2.json();
        const esError = data.response && typeof data.response === 'object' && data.response.error;
        setMessages(prev => [...prev, {
          role: 'agent',
          content: esError ? data.response.mensaje : data.response,
          isError: !!esError,
        }]);
```

Buscar también el parseo del streaming (cerca de la línea 227-229, dentro del bloque `if (parsed.error)`) y confirmar que arma el mensaje final con `isError: true` también, para que ambos caminos (streaming y fallback) marquen el mensaje de la misma forma:

```javascript
            if (parsed.error) {
              accumulated = 'Error de conexión con el servicio estratégico.';
              streamError = true;
            }
```

(agregar una variable `let streamError = false;` cerca de donde se declaran `isCampaign`/`recId` al inicio de la función, y usarla en el `setMessages` final: `isError: streamError`).

Buscar en el JSX de renderizado de mensajes (donde se mapea `messages` a burbujas) y agregar un estilo distinto cuando `msg.isError` es verdadero — un borde/ícono de advertencia en vez del estilo normal de burbuja del "CEO" (usar el mismo color de advertencia que ya usa el resto del dashboard, ej. `#f59e0b` o `theme.palette.warning.main`).

- [ ] **Step 7: Verificar en el navegador**

Con el backend corriendo, forzar un error (ej. poner temporalmente una `OPENAI_API_KEY` inválida en el entorno, o mockear), abrir el chat, hacer una pregunta, y confirmar que el mensaje de error se ve visualmente distinto a una respuesta normal — no el texto crudo de una excepción de Python/OpenAI.

- [ ] **Step 8: Commit**

```bash
git add theycallmebitch/backend/services/ai_engine.py theycallmebitch/backend/main.py theycallmebitch/backend/test_ai_engine_tools.py theycallmebitch/frontend/src/components/ChatAssistant.jsx
git commit -m "fix: structured error responses instead of raw exceptions shown as CEO answers"
```

---

### Task 3: Ubicación única del negocio

**Files:**
- Modify: `theycallmebitch/backend/services/business_context.py`
- Modify: `theycallmebitch/backend/services/ai_engine.py` (SYSTEM_PROMPT, CHAT_PROMPT)
- Modify: `theycallmebitch/backend/services/briefing_service.py` (BRIEFING_PROMPT)

**Interfaces:**
- Produces: `business_context.UBICACION_EMPRESA` (string), importado por los tres prompts.

- [ ] **Step 1: Definir la constante**

En `theycallmebitch/backend/services/business_context.py`, agregar cerca de `DISTANCIAS_KM`:

```python
UBICACION_EMPRESA = "Lago La Paloma 4565, Villa El Alba, Puente Alto, Santiago, Chile"
```

(Se usa "Puente Alto, Santiago" — no "Chiloé" — porque es la ubicación que coincide con `DISTANCIAS_KM` y con las zonas de reparto reales `puente_alto`/`la_florida`/`macul` ya usadas en el resto del sistema; "Chiloé" en `briefing_service.py` era el dato desactualizado/incorrecto.)

- [ ] **Step 2: Usar la constante en los 3 prompts**

En `theycallmebitch/backend/services/ai_engine.py`, en `SYSTEM_PROMPT` y `CHAT_PROMPT`, reemplazar la línea hardcodeada:

```python
Empresa con sede en Lago La Paloma 4565, Villa El Alba, Puente Alto, Santiago, Chile.
```

por una f-string que use la constante importada al inicio del archivo (`from services.business_context import UBICACION_EMPRESA`):

```python
SYSTEM_PROMPT = f"""Eres el CEO/COO virtual autónomo de Aguas Ancud.
Empresa con sede en {UBICACION_EMPRESA}.
...
```

(mismo tratamiento para `CHAT_PROMPT`).

En `theycallmebitch/backend/services/briefing_service.py`, agregar `from services.business_context import UBICACION_EMPRESA` y reemplazar:

```python
BRIEFING_PROMPT = """Eres el CEO/COO virtual de Aguas Ancud (Chiloé, Chile).
```

por:

```python
BRIEFING_PROMPT = f"""Eres el CEO/COO virtual de Aguas Ancud ({UBICACION_EMPRESA}).
```

- [ ] **Step 3: Verificar que no quede ninguna mención de Chiloé**

```bash
grep -rn "Chiloé\|Chiloe" theycallmebitch/backend/services/
```

Expected: sin resultados.

- [ ] **Step 4: Commit**

```bash
git add theycallmebitch/backend/services/business_context.py theycallmebitch/backend/services/ai_engine.py theycallmebitch/backend/services/briefing_service.py
git commit -m "fix: single source of truth for business location across all AI prompts (was Puente Alto in chat, Chiloé in briefing)"
```

---

### Task 4: Arreglar el botón "¿Lo ejecutaste?" (rec_id nunca llega al frontend)

**Files:**
- Modify: `theycallmebitch/backend/main.py` (`/chat`, `/chat/stream`)
- Modify: `theycallmebitch/backend/services/ai_engine.py` (`run_chat_query`, `run_chat_query_prepare` deben exponer el rec_id si `guardar_recomendacion` generó uno)
- Modify: `theycallmebitch/frontend/src/components/ChatAssistant.jsx`

**Interfaces:**
- Consumes: `memory_service.guardar_recomendacion` ya devuelve un id entero real (`memory_service.py:242-244`) — no se modifica esa función.
- Produces: el evento `meta` del SSE de `/chat/stream` incluye `rec_id` cuando corresponde; `/chat` (no-streaming) también lo incluye en su JSON de respuesta.

- [ ] **Step 1: Rastrear dónde se pierde el id hoy**

Leer `run_chat_query`/`run_chat_query_prepare` completos en `ai_engine.py` y confirmar exactamente en qué línea se llama `guardar_recomendacion` y qué se hace con el valor de retorno (probablemente se descarta). Documentar el hallazgo exacto en el reporte de esta tarea antes de tocar código — si el id se descarta en un lugar distinto al que dice la spec, ajustar el resto de los pasos a la ubicación real.

- [ ] **Step 2: Hacer que `run_chat_query`/`run_chat_query_prepare` devuelvan el rec_id junto con la respuesta**

El cambio de forma debe ser mínimo y no romper los tests de Task 2 (que asumen `run_chat_query` devuelve `str` o `{"error":...}`). Opción a implementar: agregar un tercer valor de retorno opcional o una clave adicional en el path exitoso — decidir cuál según lo que se encuentre en el Step 1, priorizando no romper el contrato ya fijado en Task 2. Si `guardar_recomendacion` se llama dentro de `_execute_tool` (para `draft_campaign_message`/`simulate_scenario`), el id debe propagarse hacia arriba a través de `run_chat_query_prepare` hasta `main.py`.

- [ ] **Step 3: Propagar el id en `/chat/stream`**

En `theycallmebitch/backend/main.py`, en el evento `meta` (línea ~870):

```python
            yield f"data: {json.dumps({'meta': {'tools_used': tools_used, 'is_campaign': is_campaign}})}\n\n"
```

agregar `rec_id` cuando `run_chat_query_prepare` lo haya devuelto:

```python
            yield f"data: {json.dumps({'meta': {'tools_used': tools_used, 'is_campaign': is_campaign, 'rec_id': rec_id}})}\n\n"
```

(`rec_id` puede ser `None` si no se generó ninguna recomendación en esta consulta — el frontend ya maneja `null` correctamente, el bug era que SIEMPRE era `null`, nunca un id real).

- [ ] **Step 4: Propagar el id en `/chat` (no-streaming)**

Igual que el paso anterior, pero en la respuesta JSON de `chat_with_agent`: `return {"response": respuesta, "rec_id": rec_id}`.

- [ ] **Step 5: Verificar en el frontend que `ChatAssistant.jsx:225` ya lee bien el campo**

`recId = parsed.meta.rec_id || null` ya está correcto — solo necesitaba que el backend mandara un valor real. Confirmar que no hace falta ningún cambio adicional acá, o ajustar si el Step 1 reveló una forma distinta.

- [ ] **Step 6: Verificar en vivo**

Con el backend corriendo, pedir en el chat algo que dispare `draft_campaign_message` o `simulate_scenario`, confirmar que aparece el botón "¿Lo ejecutaste?", hacer clic en "Sí", y verificar en `agent_memory.db` (tabla `recommendations`) que el registro correspondiente ahora tiene `ejecutada=1`.

```bash
cd theycallmebitch/backend && python -c "
import sqlite3
conn = sqlite3.connect('agent_memory.db')
cur = conn.execute('SELECT id, ejecutada, resultado FROM recommendations ORDER BY id DESC LIMIT 3')
for row in cur.fetchall(): print(row)
"
```

- [ ] **Step 7: Commit**

```bash
git add theycallmebitch/backend/main.py theycallmebitch/backend/services/ai_engine.py theycallmebitch/frontend/src/components/ChatAssistant.jsx
git commit -m "fix: propagate rec_id to the frontend so the '¿Lo ejecutaste?' feedback button actually works"
```

---

## Fase B — Conectar motores reales ya existentes

### Task 5: Tool `get_customer_risk`

**Files:**
- Modify: `theycallmebitch/backend/services/ai_engine.py` (agregar a `TOOLS` y a `_execute_tool`)

**Interfaces:**
- Consumes: `customer_risk_service.calcular_riesgo_clientes(pedidos)` — ya existe, devuelve `{'resumen': {...}, 'clientes': [...]}`. No se modifica.

- [ ] **Step 1: Agregar la definición de la tool**

En `theycallmebitch/backend/services/ai_engine.py`, agregar al final de la lista `TOOLS` (antes del `]` de cierre):

```python
    {
        "type": "function",
        "function": {
            "name": "get_customer_risk",
            "description": (
                "Riesgo de clientes basado en la cadencia PERSONAL de compra de cada uno "
                "(no un umbral genérico) y probabilidad empírica real de reorden. Más preciso "
                "que get_customer_segments para decidir a quién contactar primero. Llama cuando "
                "el usuario pregunta específicamente por priorización de contacto, valor en "
                "juego, o quiere saber qué tan urgente es contactar a un cliente."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
```

- [ ] **Step 2: Agregar la rama en `_execute_tool`**

```python
        if name == "get_customer_risk":
            from services.customer_risk_service import calcular_riesgo_clientes
            return calcular_riesgo_clientes(pedidos_cache or [])
```

- [ ] **Step 3: Escribir el test**

Agregar a `theycallmebitch/backend/test_ai_engine_tools.py`:

```python
def test_get_customer_risk_devuelve_estructura_real():
    resultado = _execute_tool("get_customer_risk", {}, [], {})
    assert "resumen" in resultado
    assert "clientes" in resultado
    assert set(resultado["resumen"].keys()) == {"activos", "en_riesgo", "inactivos"}
```

- [ ] **Step 4: Correr el test**

Run: `cd theycallmebitch/backend && python -m pytest test_ai_engine_tools.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add theycallmebitch/backend/services/ai_engine.py theycallmebitch/backend/test_ai_engine_tools.py
git commit -m "feat: wire get_customer_risk tool (personalized cadence, same engine as Predictor)"
```

---

### Task 6: Tool `get_demand_forecast`

**Files:**
- Modify: `theycallmebitch/backend/services/ai_engine.py`

**Interfaces:**
- Consumes: `demand_forecast_service.predecir_proximos_dias(pedidos, dias=7)` y `validar_precision(pedidos, dias_test=30)` — ya existen, no se modifican.

- [ ] **Step 1: Agregar la tool**

```python
    {
        "type": "function",
        "function": {
            "name": "get_demand_forecast",
            "description": (
                "Pronóstico real de demanda (modelo XGBoost, mismo que usa el módulo Predictor) "
                "para los próximos días, con rango P10-P90 y precisión histórica real (MAPE). "
                "Llama cuando el usuario pregunta cuánto va a vender, cuánta demanda esperar, "
                "o quiere planificar abastecimiento."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "dias": {
                        "type": "integer",
                        "description": "Días a pronosticar. Por defecto 7.",
                        "default": 7,
                    }
                },
                "required": [],
            },
        },
    },
```

- [ ] **Step 2: Agregar la rama**

```python
        if name == "get_demand_forecast":
            from services.demand_forecast_service import predecir_proximos_dias, validar_precision
            dias = min(int(args.get("dias", 7)), 30)
            pronostico = predecir_proximos_dias(pedidos_cache or [], dias=dias)
            precision = validar_precision(pedidos_cache or [], dias_test=30)
            return {"pronostico": pronostico, "precision_historica": precision}
```

- [ ] **Step 3: Test**

```python
def test_get_demand_forecast_devuelve_pronostico_y_precision():
    resultado = _execute_tool("get_demand_forecast", {}, [], {})
    assert "pronostico" in resultado
    assert "precision_historica" in resultado
```

- [ ] **Step 4: Correr tests y commit**

```bash
cd theycallmebitch/backend && python -m pytest test_ai_engine_tools.py -v
git add theycallmebitch/backend/services/ai_engine.py theycallmebitch/backend/test_ai_engine_tools.py
git commit -m "feat: wire get_demand_forecast tool (same XGBoost model as Predictor)"
```

---

### Task 7: Tool `get_rentabilidad_reportes`

**Files:**
- Modify: `theycallmebitch/backend/services/ai_engine.py`

**Interfaces:**
- Consumes: `main.get_analisis_rentabilidad()` y `main.get_reporte_ejecutivo()` — funciones síncronas ya existentes en `main.py` (líneas 2073 y 1846), sin parámetros. Mismo patrón de lazy-import que Task 1.

- [ ] **Step 1: Agregar la tool**

```python
    {
        "type": "function",
        "function": {
            "name": "get_rentabilidad_reportes",
            "description": (
                "Análisis de rentabilidad avanzado y reporte ejecutivo semanal, ambos ya "
                "calculados por el backend pero nunca antes disponibles en el chat. Llama "
                "cuando el usuario pide un análisis de rentabilidad detallado o un reporte "
                "ejecutivo del negocio."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
```

- [ ] **Step 2: Agregar la rama**

```python
        if name == "get_rentabilidad_reportes":
            try:
                from main import get_analisis_rentabilidad, get_reporte_ejecutivo
                return {
                    "rentabilidad": get_analisis_rentabilidad(),
                    "reporte_ejecutivo": get_reporte_ejecutivo(),
                }
            except Exception as e:
                logger.error(f"Error en get_rentabilidad_reportes: {e}")
                return {"error": "No se pudo obtener el análisis de rentabilidad"}
```

- [ ] **Step 3: Test, correr, commit**

```python
def test_get_rentabilidad_reportes_devuelve_ambos_bloques():
    resultado = _execute_tool("get_rentabilidad_reportes", {}, [], {})
    assert "rentabilidad" in resultado
    assert "reporte_ejecutivo" in resultado
```

```bash
cd theycallmebitch/backend && python -m pytest test_ai_engine_tools.py -v
git add theycallmebitch/backend/services/ai_engine.py theycallmebitch/backend/test_ai_engine_tools.py
git commit -m "feat: wire get_rentabilidad_reportes tool (connects /rentabilidad/avanzado and /reportes/ejecutivo to the chat instead of orphaned frontend cards)"
```

---

## Fase C — Servicios nuevos

Cada uno sigue el patrón: función pura en `services/nombre_service.py` + test en `test_nombre_service.py` + tool en `ai_engine.py`. Los pasos de "escribir test que falla / implementar / correr / commit" son idénticos en forma a las tareas anteriores — se listan las partes específicas de cada uno (qué calcula, con qué datos, qué firma).

### Task 8: `discount_analysis_service.py` — descuento por volumen (Portezuelo)

**Files:**
- Create: `theycallmebitch/backend/services/discount_analysis_service.py`
- Test: `theycallmebitch/backend/test_discount_analysis_service.py`
- Modify: `theycallmebitch/backend/services/ai_engine.py` (nueva tool `get_discount_analysis`, y reemplazar el uso de `ELASTICITY` en `simulate_scenario`'s `price_change`)

**Interfaces:**
- Produces: `analizar_descuento_volumen(pedidos: List[Dict]) -> Dict` con esta forma:
  ```python
  {
      "zonas_con_descuento": [
          {
              "zona_clave": "portezuelo",  # detectado por palabras clave en dirección
              "pedidos_con_descuento": 62, "pedidos_sin_descuento": 116,
              "frecuencia_promedio_dias_con_descuento": 18.2,
              "frecuencia_promedio_dias_sin_descuento": 24.5,
              "ticket_promedio_con_descuento": 5400, "ticket_promedio_sin_descuento": 6200,
              "elasticidad_estimada": 0.34,  # % cambio en frecuencia / % cambio en precio efectivo
          }
      ]
  }
  ```

- [ ] **Step 1: Escribir tests que fallan**

```python
from datetime import datetime, timedelta
from services.discount_analysis_service import analizar_descuento_volumen


def _pedido(usuario, dias_atras, precio, ordenpedido, dire='portezuelo de los azules 100'):
    fecha = (datetime.now() - timedelta(days=dias_atras)).strftime('%d-%m-%Y')
    return {
        'usuario': usuario, 'fecha': fecha, 'precio': str(precio),
        'ordenpedido': str(ordenpedido), 'dire': dire, 'nombrelocal': 'Aguas Ancud',
    }


def test_detecta_pedidos_con_descuento_por_precio_por_bidon():
    # 3 bidones a $5000 = $1667/bidon (con descuento) vs 3 bidones a $6000 = $2000/bidon (normal)
    pedidos = [
        _pedido('a@fluvi.cl', 10, 5000, 3),
        _pedido('b@fluvi.cl', 20, 6000, 3),
    ]
    resultado = analizar_descuento_volumen(pedidos)
    assert len(resultado['zonas_con_descuento']) >= 1
    zona = resultado['zonas_con_descuento'][0]
    assert zona['pedidos_con_descuento'] == 1
    assert zona['pedidos_sin_descuento'] == 1


def test_zona_sin_ningun_pedido_con_descuento_no_aparece():
    pedidos = [_pedido('a@fluvi.cl', 10, 6000, 3, dire='otra calle 123')]
    resultado = analizar_descuento_volumen(pedidos)
    assert resultado['zonas_con_descuento'] == []


def test_lista_vacia_no_rompe():
    assert analizar_descuento_volumen([]) == {'zonas_con_descuento': []}
```

- [ ] **Step 2: Correr y verificar que falla** (`ModuleNotFoundError`)

- [ ] **Step 3: Implementar**

```python
"""
Servicio de análisis de descuento por volumen.

Compara, dentro de la misma zona geográfica, pedidos que recibieron un
precio por bidón reducido (paquete/descuento) contra pedidos que pagaron
el precio normal de $2.000/bidón — para estimar si el descuento genera
más frecuencia/retención de la que cuesta en margen. Es la base real de
"elasticidad" de este proyecto: no hay variación histórica del precio
único, pero sí variación real entre pedidos con y sin descuento de
volumen dentro de una misma zona (ej. Portezuelo, Puente Alto).
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional
from collections import defaultdict

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

PRECIO_NORMAL_BIDON = 2000
UMBRAL_DESCUENTO = 1800  # precio/bidón por debajo de esto se considera "con descuento"

ZONAS_CONOCIDAS = {
    "portezuelo": ["portezuelo", "tamarix", "bauble", "baubel", "loma larga"],
}


def _parsear_fecha(fecha_str: Optional[str]):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def _detectar_zona(direccion: str) -> Optional[str]:
    dir_lower = (direccion or '').lower()
    for zona, keywords in ZONAS_CONOCIDAS.items():
        if any(kw in dir_lower for kw in keywords):
            return zona
    return None


def analizar_descuento_volumen(pedidos: List[Dict]) -> Dict:
    df = pd.DataFrame(pedidos)
    if df.empty:
        return {"zonas_con_descuento": []}

    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if df.empty or 'dire' not in df.columns:
        return {"zonas_con_descuento": []}

    df['zona'] = df['dire'].apply(_detectar_zona)
    df = df.dropna(subset=['zona'])
    if df.empty:
        return {"zonas_con_descuento": []}

    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)
    df['bidones'] = pd.to_numeric(df.get('ordenpedido', 0), errors='coerce').fillna(0)
    df = df[df['bidones'] > 0]
    df['precio_por_bidon'] = df['precio_num'] / df['bidones']
    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])

    resultado = []
    for zona, grupo in df.groupby('zona'):
        con_descuento = grupo[grupo['precio_por_bidon'] < UMBRAL_DESCUENTO]
        sin_descuento = grupo[grupo['precio_por_bidon'] >= UMBRAL_DESCUENTO]

        if con_descuento.empty and sin_descuento.empty:
            continue

        def _frecuencia_promedio(sub_df):
            if len(sub_df) < 2:
                return None
            fechas = sorted(sub_df['fecha_dt'].tolist())
            intervalos = [(fechas[i] - fechas[i - 1]).days for i in range(1, len(fechas))]
            return round(float(np.mean(intervalos)), 1) if intervalos else None

        freq_con = _frecuencia_promedio(con_descuento)
        freq_sin = _frecuencia_promedio(sin_descuento)

        elasticidad = None
        if freq_con and freq_sin and freq_sin > 0:
            precio_prom_con = con_descuento['precio_por_bidon'].mean()
            precio_prom_sin = sin_descuento['precio_por_bidon'].mean()
            if precio_prom_sin > 0:
                cambio_frecuencia_pct = (freq_sin - freq_con) / freq_sin
                cambio_precio_pct = (precio_prom_sin - precio_prom_con) / precio_prom_sin
                if cambio_precio_pct != 0:
                    elasticidad = round(cambio_frecuencia_pct / cambio_precio_pct, 2)

        resultado.append({
            "zona_clave": zona,
            "pedidos_con_descuento": int(len(con_descuento)),
            "pedidos_sin_descuento": int(len(sin_descuento)),
            "frecuencia_promedio_dias_con_descuento": freq_con,
            "frecuencia_promedio_dias_sin_descuento": freq_sin,
            "ticket_promedio_con_descuento": round(float(con_descuento['precio_num'].mean()), 0) if not con_descuento.empty else None,
            "ticket_promedio_sin_descuento": round(float(sin_descuento['precio_num'].mean()), 0) if not sin_descuento.empty else None,
            "elasticidad_estimada": elasticidad,
        })

    return {"zonas_con_descuento": resultado}
```

- [ ] **Step 4: Correr y confirmar que pasa**

- [ ] **Step 5: Agregar la tool a `ai_engine.py`**

```python
    {
        "type": "function",
        "function": {
            "name": "get_discount_analysis",
            "description": (
                "Compara pedidos con descuento por volumen (ej. paquete de 3 bidones a precio "
                "reducido en zonas como Portezuelo) contra pedidos a precio normal, dentro de la "
                "misma zona: frecuencia, ticket, y una elasticidad estimada real. Llama cuando "
                "el usuario pregunta sobre el efecto de descuentos, promociones por volumen, "
                "o elasticidad de precio."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
```

y la rama:

```python
        if name == "get_discount_analysis":
            from services.discount_analysis_service import analizar_descuento_volumen
            return analizar_descuento_volumen(pedidos_cache or [])
```

- [ ] **Step 6: Reemplazar `ELASTICITY` en `simulate_scenario`**

Buscar dónde `ELASTICITY = -0.3` (línea 19) se usa dentro de la función `simulate_scenario` (buscar `ELASTICITY` en el archivo). Reemplazar el uso del valor fijo por el valor real calculado: llamar a `analizar_descuento_volumen(pedidos_cache)` dentro de `simulate_scenario` cuando `action == "price_change"`, y usar el promedio de `elasticidad_estimada` de las zonas que tengan un valor no-nulo como reemplazo de la constante. Si ninguna zona tiene datos suficientes, usar `None` y que la simulación lo indique explícitamente en vez de caer de nuevo a un número inventado (ej. devolver un mensaje "no hay datos suficientes para estimar elasticidad real todavía" en vez de simular con un valor falso).

- [ ] **Step 7: Confirmar que `ELASTICITY` ya no se usa como valor mágico**

```bash
grep -n "ELASTICITY" theycallmebitch/backend/services/ai_engine.py
```

La constante puede quedar declarada (por compatibilidad de lectura del archivo) pero no debe usarse en ningún cálculo real — o eliminarse del todo si no queda ninguna referencia.

- [ ] **Step 8: Commit**

```bash
git add theycallmebitch/backend/services/discount_analysis_service.py theycallmebitch/backend/test_discount_analysis_service.py theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: add discount_analysis_service (Portezuelo volume-discount analysis), replaces the invented ELASTICITY=-0.3 constant with a real calculated value"
```

---

### Task 9: `route_intelligence_service.py` — inteligencia de rutas con geocoding real

**Files:**
- Create: `theycallmebitch/backend/services/route_intelligence_service.py`
- Test: `theycallmebitch/backend/test_route_intelligence_service.py`
- Modify: `theycallmebitch/backend/services/ai_engine.py`

**Interfaces:**
- Consumes: `geocoding_service.geocodificar_desde_cache(direccion)` — ya existe, solo lectura de caché, sin llamadas de red.
- Produces: `analizar_densidad_geografica(pedidos: List[Dict]) -> Dict` — agrupa pedidos geocodificados en una grilla simple (redondeando lat/lon a 2 decimales, ~1km) y devuelve las celdas con mayor densidad de pedidos que no coincidan con las 3 zonas ya conocidas (`puente_alto`/`la_florida`/`macul`), como candidatas a "zona no reconocida con volumen real".

- [ ] **Step 1: Tests que fallan**

```python
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
```

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Implementar**

```python
"""
Servicio de inteligencia de rutas.

Reemplaza el modelo de 3 zonas hardcodeadas (puente_alto/la_florida/macul,
con distancias fijas a mano) por densidad geográfica real, usando las
coordenadas ya geocodificadas para el Mapa de Calor. Solo lee del caché en
disco — nunca dispara geocodificación nueva (esa responsabilidad es del
Mapa de Calor).
"""
import logging
from collections import defaultdict
from typing import Dict, List

from services.geocoding_service import geocodificar_desde_cache

logger = logging.getLogger(__name__)

PRECISION_CELDA = 2  # decimales de lat/lon — ~1.1km de lado por celda


def analizar_densidad_geografica(pedidos: List[Dict]) -> Dict:
    if not pedidos:
        return {"celdas": []}

    conteo_por_celda: Dict[tuple, int] = defaultdict(int)
    for pedido in pedidos:
        if str(pedido.get('nombrelocal', '')).strip().lower() not in ('', 'aguas ancud'):
            continue
        direccion = pedido.get('dire') or pedido.get('direccion', '')
        if not direccion:
            continue
        coords = geocodificar_desde_cache(direccion)
        if not coords or coords.get('lat') is None or coords.get('lon') is None:
            continue
        celda = (round(coords['lat'], PRECISION_CELDA), round(coords['lon'], PRECISION_CELDA))
        conteo_por_celda[celda] += 1

    celdas = [
        {"lat": lat, "lon": lon, "pedidos": count}
        for (lat, lon), count in conteo_por_celda.items()
    ]
    celdas.sort(key=lambda c: -c["pedidos"])
    return {"celdas": celdas}
```

- [ ] **Step 4: Correr y confirmar que pasa**

- [ ] **Step 5: Agregar tool a `ai_engine.py`**

```python
    {
        "type": "function",
        "function": {
            "name": "get_route_intelligence",
            "description": (
                "Densidad geográfica real de pedidos (agrupados por celda de ~1km usando "
                "coordenadas reales geocodificadas), para detectar concentraciones de pedidos "
                "que las 3 zonas fijas actuales no capturan bien. Llama cuando el usuario "
                "pregunta por oportunidades de ruta, zonas sin explotar, o dónde concentrar "
                "reparto."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
```

```python
        if name == "get_route_intelligence":
            from services.route_intelligence_service import analizar_densidad_geografica
            return analizar_densidad_geografica(pedidos_cache or [])
```

- [ ] **Step 6: Commit**

```bash
git add theycallmebitch/backend/services/route_intelligence_service.py theycallmebitch/backend/test_route_intelligence_service.py theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: add route_intelligence_service using real geocoded coordinates instead of the 3 hardcoded zones"
```

---

### Task 10: `anomaly_detection_service.py` — detección de anomalías reales

**Files:**
- Create: `theycallmebitch/backend/services/anomaly_detection_service.py`
- Test: `theycallmebitch/backend/test_anomaly_detection_service.py`

**Interfaces:**
- Produces: `detectar_anomalias(pedidos: List[Dict]) -> List[Dict]` — cada anomalía es
  `{"tipo": "caida_pedidos"|"salto_churn", "fecha": "...", "descripcion": "...", "severidad": "alta"|"media"}`.
  Lista vacía si no hay ninguna desviación real. Esta función NO llama a OpenAI — es el paso previo, puramente estadístico, que decide si vale la pena llamar al modelo (usado en Task 22).

- [ ] **Step 1: Tests**

```python
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
    conteos = [10] * 20 + [1]
    resultado = detectar_anomalias(_pedidos_serie(conteos))
    assert any(a['tipo'] == 'caida_pedidos' for a in resultado)


def test_no_detecta_nada_si_el_patron_es_normal():
    conteos = [10, 11, 9, 10, 12, 9, 10] * 4
    resultado = detectar_anomalias(_pedidos_serie(conteos))
    assert resultado == []


def test_historial_insuficiente_no_rompe():
    assert detectar_anomalias(_pedidos_serie([5, 5, 5])) == []
```

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Implementar**

```python
"""
Servicio de detección de anomalías.

Cálculo puro (sin IA) sobre la serie diaria de pedidos: detecta
desviaciones estadísticas reales (no ruido normal) para decidir si vale la
pena generar una alerta. Reutiliza la misma construcción de serie diaria
que `demand_forecast_service.construir_serie_diaria`.
"""
import logging
from typing import Dict, List

import numpy as np

from services.demand_forecast_service import construir_serie_diaria

logger = logging.getLogger(__name__)

MIN_DIAS_HISTORIAL = 14
UMBRAL_DESVIACIONES = 2.0  # desviaciones estándar


def detectar_anomalias(pedidos: List[Dict]) -> List[Dict]:
    serie = construir_serie_diaria(pedidos)
    if len(serie) < MIN_DIAS_HISTORIAL:
        return []

    conteos = serie['pedidos'].values
    historial = conteos[:-1]
    hoy = conteos[-1]

    media = float(np.mean(historial))
    desviacion = float(np.std(historial))
    if desviacion == 0:
        return []

    z_score = (hoy - media) / desviacion
    anomalias = []
    if z_score <= -UMBRAL_DESVIACIONES:
        anomalias.append({
            "tipo": "caida_pedidos",
            "fecha": str(serie['fecha'].iloc[-1]),
            "descripcion": f"Pedidos de hoy ({int(hoy)}) muy por debajo del promedio de los últimos {len(historial)} días ({media:.1f}).",
            "severidad": "alta" if z_score <= -3 else "media",
        })
    elif z_score >= UMBRAL_DESVIACIONES:
        anomalias.append({
            "tipo": "salto_pedidos",
            "fecha": str(serie['fecha'].iloc[-1]),
            "descripcion": f"Pedidos de hoy ({int(hoy)}) muy por encima del promedio de los últimos {len(historial)} días ({media:.1f}).",
            "severidad": "media",
        })
    return anomalias
```

- [ ] **Step 4: Correr y confirmar que pasa**

- [ ] **Step 5: Commit**

```bash
git add theycallmebitch/backend/services/anomaly_detection_service.py theycallmebitch/backend/test_anomaly_detection_service.py
git commit -m "feat: add anomaly_detection_service, pure statistical check with no AI cost (used by Task 22 to gate the autonomous loop)"
```

(Nota: esta tarea no agrega una tool de chat — se usa exclusivamente en Task 22 para reformar el loop autónomo. No requiere cambios en `ai_engine.py`.)

---

### Task 11: `opportunity_service.py` — clientes en crecimiento (espejo de customer_risk_service)

**Files:**
- Create: `theycallmebitch/backend/services/opportunity_service.py`
- Test: `theycallmebitch/backend/test_opportunity_service.py`
- Modify: `theycallmebitch/backend/services/ai_engine.py`

**Interfaces:**
- Produces: `detectar_oportunidades_crecimiento(pedidos: List[Dict]) -> Dict` con forma
  `{"clientes": [{"usuario", "cadencia_anterior_dias", "cadencia_reciente_dias", "crecimiento_pct", "gasto_promedio"}]}` —
  clientes cuya cadencia de compra reciente (últimos 60 días) es significativamente más corta que su cadencia histórica (más de 60 días atrás), ordenados por `gasto_promedio` descendente.

- [ ] **Step 1: Tests**

```python
from datetime import datetime, timedelta
from services.opportunity_service import detectar_oportunidades_crecimiento


def _pedido(usuario, dias_atras, precio=2000):
    fecha = (datetime.now() - timedelta(days=dias_atras)).strftime('%d-%m-%Y')
    return {'usuario': usuario, 'fecha': fecha, 'precio': str(precio), 'nombrelocal': 'Aguas Ancud'}


def test_detecta_cliente_que_acelero_su_compra():
    # Históricamente cada 30 días, últimos 60 días cada 10 días
    pedidos = [
        _pedido('ana@fluvi.cl', 200), _pedido('ana@fluvi.cl', 170), _pedido('ana@fluvi.cl', 140),
        _pedido('ana@fluvi.cl', 50), _pedido('ana@fluvi.cl', 40), _pedido('ana@fluvi.cl', 30), _pedido('ana@fluvi.cl', 20),
    ]
    resultado = detectar_oportunidades_crecimiento(pedidos)
    assert len(resultado['clientes']) == 1
    assert resultado['clientes'][0]['usuario'] == 'ana@fluvi.cl'
    assert resultado['clientes'][0]['crecimiento_pct'] > 0


def test_cliente_con_cadencia_estable_no_aparece():
    pedidos = [_pedido('bruno@fluvi.cl', d) for d in [180, 150, 120, 90, 60, 30]]
    resultado = detectar_oportunidades_crecimiento(pedidos)
    assert resultado['clientes'] == []


def test_lista_vacia_no_rompe():
    assert detectar_oportunidades_crecimiento([]) == {'clientes': []}
```

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Implementar**

```python
"""
Servicio de detección de oportunidad (crecimiento de clientes).

Espejo de customer_risk_service: en vez de detectar clientes que se
atrasan respecto a su cadencia personal, detecta clientes cuya cadencia
RECIENTE (últimos 60 días) es más corta que su cadencia histórica —
señal real de que están comprando más seguido, no una suposición.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

VENTANA_RECIENTE_DIAS = 60
MIN_PEDIDOS_POR_VENTANA = 2
UMBRAL_CRECIMIENTO_PCT = 0.20  # 20% más rápido


def _parsear_fecha(fecha_str):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def _cadencia(fechas: list) -> float:
    if len(fechas) < 2:
        return None
    fechas = sorted(fechas)
    intervalos = [(fechas[i] - fechas[i - 1]).days for i in range(1, len(fechas))]
    return float(np.mean(intervalos))


def detectar_oportunidades_crecimiento(pedidos: List[Dict]) -> Dict:
    df = pd.DataFrame(pedidos)
    if df.empty:
        return {"clientes": []}
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if df.empty or 'usuario' not in df.columns:
        return {"clientes": []}
    df = df[df['usuario'].astype(str).str.strip() != '']
    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])
    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)

    hoy = datetime.now()
    corte_reciente = hoy - timedelta(days=VENTANA_RECIENTE_DIAS)

    resultado = []
    for usuario, grupo in df.groupby('usuario'):
        fechas = grupo['fecha_dt'].tolist()
        recientes = [f for f in fechas if f >= corte_reciente]
        antiguas = [f for f in fechas if f < corte_reciente]

        if len(recientes) < MIN_PEDIDOS_POR_VENTANA or len(antiguas) < MIN_PEDIDOS_POR_VENTANA:
            continue

        cadencia_reciente = _cadencia(recientes)
        cadencia_anterior = _cadencia(antiguas)
        if not cadencia_reciente or not cadencia_anterior or cadencia_anterior <= 0:
            continue

        crecimiento_pct = (cadencia_anterior - cadencia_reciente) / cadencia_anterior
        if crecimiento_pct >= UMBRAL_CRECIMIENTO_PCT:
            resultado.append({
                "usuario": usuario,
                "cadencia_anterior_dias": round(cadencia_anterior, 1),
                "cadencia_reciente_dias": round(cadencia_reciente, 1),
                "crecimiento_pct": round(crecimiento_pct * 100, 1),
                "gasto_promedio": round(float(grupo['precio_num'].mean()), 0),
            })

    resultado.sort(key=lambda c: -c['gasto_promedio'])
    return {"clientes": resultado}
```

- [ ] **Step 4: Correr y confirmar que pasa**

- [ ] **Step 5: Tool en `ai_engine.py`**

```python
    {
        "type": "function",
        "function": {
            "name": "get_growth_opportunities",
            "description": (
                "Clientes cuya frecuencia de compra reciente (últimos 60 días) aumentó "
                "significativamente respecto a su patrón histórico — señal real de negocio "
                "creciendo, candidatos a ofrecerles un plan mayor. Llama cuando el usuario "
                "pregunta por oportunidades de crecimiento, upsell, o clientes que están "
                "comprando más."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
```

```python
        if name == "get_growth_opportunities":
            from services.opportunity_service import detectar_oportunidades_crecimiento
            return detectar_oportunidades_crecimiento(pedidos_cache or [])
```

- [ ] **Step 6: Commit**

```bash
git add theycallmebitch/backend/services/opportunity_service.py theycallmebitch/backend/test_opportunity_service.py theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: add opportunity_service, mirrors customer_risk_service to detect growing customers instead of at-risk ones"
```

---

### Task 12: `margin_leak_service.py` — fuga de margen (costos + zonas + combustible)

**Files:**
- Create: `theycallmebitch/backend/services/margin_leak_service.py`
- Test: `theycallmebitch/backend/test_margin_leak_service.py`
- Modify: `theycallmebitch/backend/services/ai_engine.py`

**Interfaces:**
- Consumes: `zone_engine.analizar_zonas(pedidos)` (ya calcula `revenue_por_km`) + `fuel_service.obtener_precio_bencina()` (precio real del combustible del día).
- Produces: `detectar_fuga_margen(pedidos: List[Dict], precio_combustible_litro: float) -> Dict` — para cada zona activa, costo estimado de combustible por pedido entregado (usando `FUEL_COST_PER_KM`/distancia ya conocida en `business_context.DISTANCIAS_KM`, multiplicado por el precio real del combustible del día en vez de un valor fijo), comparado contra el revenue promedio por pedido de esa zona. Marca como "fuga" las zonas donde el costo de combustible por pedido supere el 15% del ticket promedio de esa zona.

- [ ] **Step 1: Tests**

```python
from services.margin_leak_service import detectar_fuga_margen


def test_detecta_zona_con_costo_combustible_desproporcionado():
    zonas_data = {
        "zonas": [
            {"zona": "macul", "distancia_km": 12, "revenue_30d": 60000, "pedidos_30d": 3},  # ticket ~20000, pocos pedidos, muy lejos
            {"zona": "puente_alto", "distancia_km": 2, "revenue_30d": 200000, "pedidos_30d": 40},
        ]
    }
    resultado = detectar_fuga_margen(zonas_data, precio_combustible_litro=1200, consumo_km_por_litro=10)
    zonas_fuga = [z['zona'] for z in resultado['fugas']]
    assert 'macul' in zonas_fuga


def test_sin_zonas_no_rompe():
    assert detectar_fuga_margen({"zonas": []}, precio_combustible_litro=1200, consumo_km_por_litro=10) == {"fugas": []}
```

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Implementar**

```python
"""
Servicio de detección de fuga de margen.

Cruza el revenue por pedido de cada zona (ya calculado por zone_engine)
con el costo REAL de combustible del día (fuel_service), en vez de un
costo fijo asumido — para detectar zonas donde el costo de despacho se
está comiendo el margen sin que ningún KPI actual lo muestre.
"""
import logging
from typing import Dict

logger = logging.getLogger(__name__)

UMBRAL_FUGA_PCT = 0.15  # costo de combustible > 15% del ticket promedio de la zona = fuga


def detectar_fuga_margen(zonas_data: Dict, precio_combustible_litro: float, consumo_km_por_litro: float = 10.0) -> Dict:
    zonas = zonas_data.get("zonas", [])
    fugas = []

    for z in zonas:
        distancia = z.get("distancia_km")
        pedidos_30d = z.get("pedidos_30d", 0)
        revenue_30d = z.get("revenue_30d", 0)

        if not distancia or pedidos_30d <= 0 or precio_combustible_litro <= 0:
            continue

        ticket_promedio = revenue_30d / pedidos_30d
        # ida y vuelta
        costo_combustible_viaje = (distancia * 2 / consumo_km_por_litro) * precio_combustible_litro

        if ticket_promedio > 0 and (costo_combustible_viaje / ticket_promedio) > UMBRAL_FUGA_PCT:
            fugas.append({
                "zona": z["zona"],
                "ticket_promedio": round(ticket_promedio, 0),
                "costo_combustible_por_pedido": round(costo_combustible_viaje, 0),
                "pct_del_ticket": round((costo_combustible_viaje / ticket_promedio) * 100, 1),
            })

    return {"fugas": fugas}
```

- [ ] **Step 4: Correr y confirmar que pasa**

- [ ] **Step 5: Tool en `ai_engine.py`**

```python
    {
        "type": "function",
        "function": {
            "name": "get_margin_leak_analysis",
            "description": (
                "Detecta zonas donde el costo real de combustible por pedido entregado es "
                "desproporcionado respecto al ticket promedio de esa zona — usa el precio de "
                "combustible del día, no un valor fijo. Llama cuando el usuario pregunta por "
                "costos de reparto, rentabilidad por zona, o fuga de margen."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
```

```python
        if name == "get_margin_leak_analysis":
            from services.margin_leak_service import detectar_fuga_margen
            from services.zone_engine import analizar_zonas
            from services.fuel_service import obtener_precio_bencina
            zonas_data = analizar_zonas(pedidos_cache or [])
            precio_combustible = obtener_precio_bencina().get("precio_litro", 1200)
            return detectar_fuga_margen(zonas_data, precio_combustible_litro=precio_combustible)
```

(Verificar el nombre real de la clave que devuelve `obtener_precio_bencina()` antes de este paso — leer `fuel_service.py` completo si el nombre `precio_litro` no coincide, y ajustar.)

- [ ] **Step 6: Commit**

```bash
git add theycallmebitch/backend/services/margin_leak_service.py theycallmebitch/backend/test_margin_leak_service.py theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: add margin_leak_service, crosses real zone revenue with real daily fuel price instead of a fixed cost assumption"
```

---

### Task 13: `payment_risk_service.py` — riesgo de cobranza por método de pago

**Files:**
- Create: `theycallmebitch/backend/services/payment_risk_service.py`
- Test: `theycallmebitch/backend/test_payment_risk_service.py`
- Modify: `theycallmebitch/backend/services/ai_engine.py`

**Interfaces:**
- Produces: `analizar_riesgo_pago(pedidos: List[Dict]) -> Dict` — para cada `metodopago` presente en los datos, tasa de pedidos con `status` de cancelado/fallido, y conteo total, ordenado por tasa de cancelación descendente.

- [ ] **Step 1: Tests**

```python
from services.payment_risk_service import analizar_riesgo_pago


def _pedido(metodopago, status='entregado'):
    return {'metodopago': metodopago, 'status': status, 'nombrelocal': 'Aguas Ancud'}


def test_calcula_tasa_de_cancelacion_por_metodo():
    pedidos = [
        _pedido('transferencia', 'entregado'), _pedido('transferencia', 'entregado'),
        _pedido('transferencia', 'cancelado'),
        _pedido('efectivo', 'entregado'), _pedido('efectivo', 'entregado'),
    ]
    resultado = analizar_riesgo_pago(pedidos)
    transferencia = next(m for m in resultado['metodos'] if m['metodo'] == 'transferencia')
    efectivo = next(m for m in resultado['metodos'] if m['metodo'] == 'efectivo')
    assert transferencia['tasa_cancelacion_pct'] > efectivo['tasa_cancelacion_pct']


def test_lista_vacia_no_rompe():
    assert analizar_riesgo_pago([]) == {'metodos': []}
```

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Implementar**

```python
"""
Servicio de riesgo de cobranza por método de pago.

Calcula la tasa real de cancelación/fallo por método de pago — dato que
hoy no se cruza en ningún KPI ni módulo del dashboard.
"""
import logging
from typing import Dict, List

import pandas as pd

logger = logging.getLogger(__name__)

ESTADOS_FALLIDOS = {'cancelado', 'fallido', 'rechazado'}


def analizar_riesgo_pago(pedidos: List[Dict]) -> Dict:
    df = pd.DataFrame(pedidos)
    if df.empty:
        return {"metodos": []}
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if df.empty or 'metodopago' not in df.columns:
        return {"metodos": []}

    df['metodo_norm'] = df['metodopago'].astype(str).str.strip().str.lower()
    df = df[df['metodo_norm'] != '']
    df['es_fallido'] = df.get('status', '').astype(str).str.strip().str.lower().isin(ESTADOS_FALLIDOS)

    resultado = []
    for metodo, grupo in df.groupby('metodo_norm'):
        total = len(grupo)
        fallidos = int(grupo['es_fallido'].sum())
        resultado.append({
            "metodo": metodo,
            "total_pedidos": total,
            "pedidos_fallidos": fallidos,
            "tasa_cancelacion_pct": round((fallidos / total) * 100, 1) if total > 0 else 0,
        })

    resultado.sort(key=lambda m: -m['tasa_cancelacion_pct'])
    return {"metodos": resultado}
```

- [ ] **Step 4: Correr y confirmar que pasa**

- [ ] **Step 5: Tool en `ai_engine.py`**

```python
    {
        "type": "function",
        "function": {
            "name": "get_payment_risk_analysis",
            "description": (
                "Tasa real de cancelación/fallo de pedidos por método de pago (transferencia, "
                "efectivo, tarjeta). Llama cuando el usuario pregunta por riesgo de cobranza, "
                "métodos de pago problemáticos, o pedidos cancelados."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
```

```python
        if name == "get_payment_risk_analysis":
            from services.payment_risk_service import analizar_riesgo_pago
            return analizar_riesgo_pago(pedidos_cache or [])
```

- [ ] **Step 6: Commit**

```bash
git add theycallmebitch/backend/services/payment_risk_service.py theycallmebitch/backend/test_payment_risk_service.py theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: add payment_risk_service, real cancellation rate by payment method"
```

---

### Task 14: `channel_comparison_service.py` — Local vs Delivery

**Files:**
- Create: `theycallmebitch/backend/services/channel_comparison_service.py`
- Test: `theycallmebitch/backend/test_channel_comparison_service.py`
- Modify: `theycallmebitch/backend/services/ai_engine.py`

**Interfaces:**
- Produces: `comparar_canales(pedidos: List[Dict]) -> Dict` — separa pedidos por `retirolocal == 'si'` (Local) vs el resto (Delivery), y compara revenue de los últimos 30 días vs los 30 días anteriores para cada canal (mismo patrón de comparación MoM que ya usa `business_context.py`).

- [ ] **Step 1: Tests**

```python
from datetime import datetime, timedelta
from services.channel_comparison_service import comparar_canales


def _pedido(dias_atras, retirolocal, precio=2000):
    fecha = (datetime.now() - timedelta(days=dias_atras)).strftime('%d-%m-%Y')
    return {'fecha': fecha, 'retirolocal': retirolocal, 'precio': str(precio), 'nombrelocal': 'Aguas Ancud'}


def test_compara_ambos_canales_periodo_actual_vs_anterior():
    pedidos = (
        [_pedido(10, 'si') for _ in range(5)] + [_pedido(40, 'si') for _ in range(10)] +
        [_pedido(10, 'no') for _ in range(20)] + [_pedido(40, 'no') for _ in range(20)]
    )
    resultado = comparar_canales(pedidos)
    assert resultado['local']['pedidos_30d'] == 5
    assert resultado['delivery']['pedidos_30d'] == 20


def test_lista_vacia_no_rompe():
    resultado = comparar_canales([])
    assert resultado['local']['pedidos_30d'] == 0
    assert resultado['delivery']['pedidos_30d'] == 0
```

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Implementar**

```python
"""
Servicio de comparación de canales (Local vs Delivery).

Compara los últimos 30 días vs los 30 días anteriores en cada canal, para
responder si un canal compensa una caída del otro, o si ambos caen
juntos — comparación que hoy no existe en ningún módulo.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List

import pandas as pd

logger = logging.getLogger(__name__)


def _parsear_fecha(fecha_str):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def _resumen_canal(df_canal: pd.DataFrame, hoy: datetime) -> Dict:
    corte_30 = hoy - timedelta(days=30)
    corte_60 = hoy - timedelta(days=60)

    df_30d = df_canal[df_canal['fecha_dt'] >= corte_30]
    df_prev = df_canal[(df_canal['fecha_dt'] >= corte_60) & (df_canal['fecha_dt'] < corte_30)]

    revenue_30d = float(df_30d['precio_num'].sum())
    revenue_prev = float(df_prev['precio_num'].sum())
    tendencia_pct = round(((revenue_30d - revenue_prev) / revenue_prev) * 100, 1) if revenue_prev > 0 else None

    return {
        "pedidos_30d": int(len(df_30d)),
        "revenue_30d": round(revenue_30d, 0),
        "revenue_periodo_anterior": round(revenue_prev, 0),
        "tendencia_pct": tendencia_pct,
    }


def comparar_canales(pedidos: List[Dict]) -> Dict:
    vacio = {"pedidos_30d": 0, "revenue_30d": 0, "revenue_periodo_anterior": 0, "tendencia_pct": None}
    df = pd.DataFrame(pedidos)
    if df.empty:
        return {"local": dict(vacio), "delivery": dict(vacio)}

    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if df.empty:
        return {"local": dict(vacio), "delivery": dict(vacio)}

    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])
    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)
    df['es_local'] = df.get('retirolocal', '').astype(str).str.strip().str.lower() == 'si'

    hoy = datetime.now()
    return {
        "local": _resumen_canal(df[df['es_local']], hoy),
        "delivery": _resumen_canal(df[~df['es_local']], hoy),
    }
```

- [ ] **Step 4: Correr y confirmar que pasa**

- [ ] **Step 5: Tool en `ai_engine.py`**

```python
    {
        "type": "function",
        "function": {
            "name": "get_channel_comparison",
            "description": (
                "Compara ventas de Local (mostrador) vs Delivery, últimos 30 días vs los 30 "
                "anteriores en cada canal. Llama cuando el usuario pregunta si el local está "
                "compensando el delivery, o quiere comparar canales de venta."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
```

```python
        if name == "get_channel_comparison":
            from services.channel_comparison_service import comparar_canales
            return comparar_canales(pedidos_cache or [])
```

- [ ] **Step 6: Commit**

```bash
git add theycallmebitch/backend/services/channel_comparison_service.py theycallmebitch/backend/test_channel_comparison_service.py theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: add channel_comparison_service, Local vs Delivery month-over-month comparison"
```

---

### Task 15: `building_opportunity_service.py` — oportunidad mayorista por edificio

**Files:**
- Create: `theycallmebitch/backend/services/building_opportunity_service.py`
- Test: `theycallmebitch/backend/test_building_opportunity_service.py`
- Modify: `theycallmebitch/backend/services/ai_engine.py`

**Interfaces:**
- Produces: `detectar_oportunidad_edificio(pedidos: List[Dict]) -> Dict` — agrupa por dirección **normalizada** (no por `usuario`, a propósito: varios emails distintos pueden compartir la misma dirección real), y devuelve direcciones con 3+ `usuario`s distintos activos, ordenadas por pedidos totales combinados descendente.

- [ ] **Step 1: Tests**

```python
from services.building_opportunity_service import detectar_oportunidad_edificio


def _pedido(usuario, dire, precio=2000):
    return {'usuario': usuario, 'dire': dire, 'precio': str(precio), 'nombrelocal': 'Aguas Ancud'}


def test_detecta_edificio_con_multiples_clientes():
    pedidos = [
        _pedido('a@fluvi.cl', 'depto A block 1, edificio central 100'),
        _pedido('b@fluvi.cl', 'depto B block 1, edificio central 100'),
        _pedido('c@fluvi.cl', 'depto C block 1, edificio central 100'),
        _pedido('d@fluvi.cl', 'otra calle 200'),
    ]
    resultado = detectar_oportunidad_edificio(pedidos)
    assert len(resultado['edificios']) == 1
    assert resultado['edificios'][0]['clientes_distintos'] == 3


def test_direccion_con_pocos_clientes_no_aparece():
    pedidos = [_pedido('a@fluvi.cl', 'calle sola 1'), _pedido('b@fluvi.cl', 'calle sola 1')]
    resultado = detectar_oportunidad_edificio(pedidos)
    assert resultado['edificios'] == []


def test_lista_vacia_no_rompe():
    assert detectar_oportunidad_edificio([]) == {'edificios': []}
```

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Implementar**

```python
"""
Servicio de detección de oportunidad mayorista por edificio/condominio.

Agrupa pedidos por DIRECCIÓN normalizada, no por usuario/email — varios
"clientes" con emails auto-generados distintos pueden ser, en realidad,
distintos departamentos del mismo edificio pidiendo cada uno por su
cuenta. Eso es una oportunidad real de contrato mayorista único que hoy
no se ve en ningún lado, porque todo el resto del sistema agrupa por
usuario.
"""
import logging
from typing import Dict, List

import pandas as pd

logger = logging.getLogger(__name__)

MIN_CLIENTES_DISTINTOS = 3


def _normalizar_direccion(direccion: str) -> str:
    return (direccion or '').strip().lower()


def detectar_oportunidad_edificio(pedidos: List[Dict]) -> Dict:
    df = pd.DataFrame(pedidos)
    if df.empty:
        return {"edificios": []}
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if df.empty or 'dire' not in df.columns or 'usuario' not in df.columns:
        return {"edificios": []}

    df['direccion_norm'] = df['dire'].apply(_normalizar_direccion)
    df = df[df['direccion_norm'] != '']
    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)

    resultado = []
    for direccion, grupo in df.groupby('direccion_norm'):
        clientes_distintos = grupo['usuario'].nunique()
        if clientes_distintos < MIN_CLIENTES_DISTINTOS:
            continue
        resultado.append({
            "direccion": direccion,
            "clientes_distintos": int(clientes_distintos),
            "pedidos_totales": int(len(grupo)),
            "revenue_total": round(float(grupo['precio_num'].sum()), 0),
        })

    resultado.sort(key=lambda e: -e['pedidos_totales'])
    return {"edificios": resultado}
```

- [ ] **Step 4: Correr y confirmar que pasa**

- [ ] **Step 5: Tool en `ai_engine.py`**

```python
    {
        "type": "function",
        "function": {
            "name": "get_building_opportunities",
            "description": (
                "Detecta direcciones (edificios/condominios) donde 3 o más clientes distintos "
                "piden individualmente — oportunidad real de contrato mayorista único. Llama "
                "cuando el usuario pregunta por oportunidades de contratos grandes, edificios, "
                "o condominios."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
```

```python
        if name == "get_building_opportunities":
            from services.building_opportunity_service import detectar_oportunidad_edificio
            return detectar_oportunidad_edificio(pedidos_cache or [])
```

- [ ] **Step 6: Commit**

```bash
git add theycallmebitch/backend/services/building_opportunity_service.py theycallmebitch/backend/test_building_opportunity_service.py theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: add building_opportunity_service, groups by address instead of email to detect building-wide wholesale opportunities"
```

---

### Task 16: `sla_compliance_service.py` — % cumplimiento de horario

**Files:**
- Create: `theycallmebitch/backend/services/sla_compliance_service.py`
- Test: `theycallmebitch/backend/test_sla_compliance_service.py`
- Modify: `theycallmebitch/backend/services/ai_engine.py`

**Interfaces:**
- Produces: `calcular_cumplimiento_horario(pedidos: List[Dict]) -> Dict` — % de pedidos entregados dentro de ±1 hora de `horaagenda`, calculado globalmente y por zona (si `dire` permite inferir zona vía las mismas palabras clave/distancia ya usadas). **Alcance confirmado por el usuario**: solo el porcentaje de cumplimiento, no un score de desempeño por repartidor individual.

- [ ] **Step 1: Tests**

```python
from services.sla_compliance_service import calcular_cumplimiento_horario


def _pedido(horaagenda, horaentrega):
    return {'horaagenda': horaagenda, 'horaentrega': horaentrega, 'nombrelocal': 'Aguas Ancud'}


def test_calcula_pct_dentro_de_ventana():
    pedidos = [
        _pedido('14:00', '2026-07-20T14:30:00'),  # dentro de 1h
        _pedido('14:00', '2026-07-20T16:30:00'),  # fuera de 1h
        _pedido('10:00', '2026-07-20T10:15:00'),  # dentro
    ]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pct_cumplimiento'] == round(2 / 3 * 100, 1)


def test_pedidos_sin_datos_de_hora_se_ignoran():
    pedidos = [_pedido('', ''), _pedido(None, None)]
    resultado = calcular_cumplimiento_horario(pedidos)
    assert resultado['pedidos_evaluados'] == 0
    assert resultado['pct_cumplimiento'] is None


def test_lista_vacia_no_rompe():
    resultado = calcular_cumplimiento_horario([])
    assert resultado['pct_cumplimiento'] is None
```

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Implementar**

Leer primero cómo llega `horaagenda` (formato `HH:MM` según `data_adapter.py:244`) y `horaentrega` (ISO timestamp completo, `deliveredAt` del pedido nuevo — puede venir vacío para pedidos antiguos que no lo registraron) para asegurarse de parsear ambos formatos correctamente antes de escribir la función.

```python
"""
Servicio de cumplimiento de promesa de entrega (SLA).

% de pedidos entregados dentro de una ventana de tolerancia respecto a la
hora agendada. Alcance deliberadamente acotado: solo el porcentaje de
cumplimiento, no un score de desempeño individual por repartidor.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

TOLERANCIA_MINUTOS = 60


def _parsear_hora_agenda(valor: Optional[str], fecha_referencia: datetime) -> Optional[datetime]:
    if not valor:
        return None
    try:
        hora, minuto = map(int, valor.strip().split(':')[:2])
        return fecha_referencia.replace(hour=hora, minute=minuto, second=0, microsecond=0)
    except (ValueError, AttributeError):
        return None


def _parsear_hora_entrega(valor: Optional[str]) -> Optional[datetime]:
    if not valor:
        return None
    try:
        return datetime.fromisoformat(str(valor).replace('Z', '+00:00')).replace(tzinfo=None)
    except (ValueError, AttributeError):
        return None


def calcular_cumplimiento_horario(pedidos: List[Dict]) -> Dict:
    evaluados = 0
    cumplidos = 0

    for pedido in pedidos:
        if str(pedido.get('nombrelocal', '')).strip().lower() not in ('', 'aguas ancud'):
            continue
        entrega = _parsear_hora_entrega(pedido.get('horaentrega'))
        if not entrega:
            continue
        agenda = _parsear_hora_agenda(pedido.get('horaagenda'), entrega)
        if not agenda:
            continue

        evaluados += 1
        diferencia_min = abs((entrega - agenda).total_seconds()) / 60
        if diferencia_min <= TOLERANCIA_MINUTOS:
            cumplidos += 1

    if evaluados == 0:
        return {"pedidos_evaluados": 0, "pct_cumplimiento": None}

    return {
        "pedidos_evaluados": evaluados,
        "pedidos_cumplidos": cumplidos,
        "pct_cumplimiento": round((cumplidos / evaluados) * 100, 1),
    }
```

- [ ] **Step 4: Correr y confirmar que pasa** (ajustar el parseo de fechas si el Step 3's investigación reveló un formato distinto al asumido)

- [ ] **Step 5: Tool en `ai_engine.py`**

```python
    {
        "type": "function",
        "function": {
            "name": "get_sla_compliance",
            "description": (
                "% real de pedidos entregados dentro de la ventana horaria prometida al "
                "cliente. Llama cuando el usuario pregunta por puntualidad de entrega, "
                "cumplimiento de horario, o calidad de servicio de reparto."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
```

```python
        if name == "get_sla_compliance":
            from services.sla_compliance_service import calcular_cumplimiento_horario
            return calcular_cumplimiento_horario(pedidos_cache or [])
```

- [ ] **Step 6: Commit**

```bash
git add theycallmebitch/backend/services/sla_compliance_service.py theycallmebitch/backend/test_sla_compliance_service.py theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: add sla_compliance_service, real on-time delivery percentage (scope limited to compliance %, not per-driver scoring, per explicit user decision)"
```

---

### Task 17: `activation_service.py` — activación de clientes nuevos

**Files:**
- Create: `theycallmebitch/backend/services/activation_service.py`
- Test: `theycallmebitch/backend/test_activation_service.py`
- Modify: `theycallmebitch/backend/services/ai_engine.py`

**Interfaces:**
- Produces: `calcular_tasa_activacion(pedidos: List[Dict], ventana_dias: int = 30) -> Dict` — de los clientes cuya primera compra fue hace más de `ventana_dias` (para darles tiempo de haber podido volver), qué % hizo una segunda compra dentro de `ventana_dias` desde la primera, y el tiempo promedio hasta esa segunda compra.

- [ ] **Step 1: Tests**

```python
from datetime import datetime, timedelta
from services.activation_service import calcular_tasa_activacion


def _pedido(usuario, dias_atras, precio=2000):
    fecha = (datetime.now() - timedelta(days=dias_atras)).strftime('%d-%m-%Y')
    return {'usuario': usuario, 'fecha': fecha, 'precio': str(precio), 'nombrelocal': 'Aguas Ancud'}


def test_calcula_tasa_de_segunda_compra():
    pedidos = (
        [_pedido('activado@fluvi.cl', 90), _pedido('activado@fluvi.cl', 75)] +  # segunda compra a los 15 días
        [_pedido('no_activado@fluvi.cl', 90)]  # nunca volvió
    )
    resultado = calcular_tasa_activacion(pedidos, ventana_dias=30)
    assert resultado['clientes_evaluados'] == 2
    assert resultado['clientes_activados'] == 1
    assert resultado['tasa_activacion_pct'] == 50.0


def test_cliente_muy_reciente_no_se_evalua_todavia():
    # primera compra hace 5 días, ventana de 30 — no le ha dado tiempo, se excluye
    pedidos = [_pedido('nuevo@fluvi.cl', 5)]
    resultado = calcular_tasa_activacion(pedidos, ventana_dias=30)
    assert resultado['clientes_evaluados'] == 0


def test_lista_vacia_no_rompe():
    resultado = calcular_tasa_activacion([], ventana_dias=30)
    assert resultado['tasa_activacion_pct'] is None
```

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Implementar**

```python
"""
Servicio de activación de clientes nuevos.

Distinto de churn (que mide clientes existentes que se van): mide, de los
clientes cuya PRIMERA compra fue hace suficiente tiempo como para haber
podido volver, qué porcentaje realmente hizo una segunda compra dentro de
la ventana — diagnóstico de conversión del primer pedido.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


def _parsear_fecha(fecha_str):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def calcular_tasa_activacion(pedidos: List[Dict], ventana_dias: int = 30) -> Dict:
    df = pd.DataFrame(pedidos)
    if df.empty:
        return {"clientes_evaluados": 0, "clientes_activados": 0, "tasa_activacion_pct": None, "dias_promedio_segunda_compra": None}
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if df.empty or 'usuario' not in df.columns:
        return {"clientes_evaluados": 0, "clientes_activados": 0, "tasa_activacion_pct": None, "dias_promedio_segunda_compra": None}

    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])

    hoy = datetime.now()
    corte_elegible = hoy - timedelta(days=ventana_dias)

    evaluados = 0
    activados = 0
    dias_hasta_segunda = []

    for usuario, grupo in df.groupby('usuario'):
        fechas = sorted(grupo['fecha_dt'].tolist())
        primera_compra = fechas[0]
        if primera_compra > corte_elegible:
            continue  # no le ha dado tiempo de volver todavía

        evaluados += 1
        if len(fechas) >= 2:
            segunda_compra = fechas[1]
            dias = (segunda_compra - primera_compra).days
            if dias <= ventana_dias:
                activados += 1
                dias_hasta_segunda.append(dias)

    if evaluados == 0:
        return {"clientes_evaluados": 0, "clientes_activados": 0, "tasa_activacion_pct": None, "dias_promedio_segunda_compra": None}

    return {
        "clientes_evaluados": evaluados,
        "clientes_activados": activados,
        "tasa_activacion_pct": round((activados / evaluados) * 100, 1),
        "dias_promedio_segunda_compra": round(float(np.mean(dias_hasta_segunda)), 1) if dias_hasta_segunda else None,
    }
```

- [ ] **Step 4: Correr y confirmar que pasa**

- [ ] **Step 5: Tool en `ai_engine.py`**

```python
    {
        "type": "function",
        "function": {
            "name": "get_activation_rate",
            "description": (
                "De los clientes nuevos, qué porcentaje real hace una segunda compra y en "
                "cuánto tiempo — diagnóstico de conversión del primer pedido, distinto de "
                "churn. Llama cuando el usuario pregunta por activación de clientes nuevos, "
                "conversión, o por qué los clientes nuevos no vuelven."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
```

```python
        if name == "get_activation_rate":
            from services.activation_service import calcular_tasa_activacion
            return calcular_tasa_activacion(pedidos_cache or [])
```

- [ ] **Step 6: Commit**

```bash
git add theycallmebitch/backend/services/activation_service.py theycallmebitch/backend/test_activation_service.py theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: add activation_service, real first-to-second-purchase conversion rate"
```

---

### Task 18: `seasonal_churn_service.py` — churn estacional vs real

**Files:**
- Create: `theycallmebitch/backend/services/seasonal_churn_service.py`
- Test: `theycallmebitch/backend/test_seasonal_churn_service.py`
- Modify: `theycallmebitch/backend/services/ai_engine.py`

**Interfaces:**
- Consumes: la lista de clientes `inactivo` que ya produce `customer_risk_service.calcular_riesgo_clientes` (no se modifica ese servicio).
- Produces: `clasificar_churn_estacional(pedidos: List[Dict], clientes_inactivos: List[Dict]) -> Dict` — para cada cliente inactivo, revisa su historial completo de pedidos: si tiene 2+ años de antigüedad y un patrón de inactividad que se repite en la misma época del año (ej. siempre sin comprar en invierno, o siempre reactivado en la misma temporada), lo marca `"estacional"`; si no, `"real"`.

- [ ] **Step 1: Tests**

```python
from datetime import datetime, timedelta
from services.seasonal_churn_service import clasificar_churn_estacional


def _pedido(usuario, fecha_str):
    return {'usuario': usuario, 'fecha': fecha_str, 'nombrelocal': 'Aguas Ancud'}


def test_detecta_patron_estacional_real():
    # Cliente que compra en verano (dic-feb) todos los años, nada el resto — patrón de 2+ años
    pedidos = [
        _pedido('estacional@fluvi.cl', '15-12-2023'), _pedido('estacional@fluvi.cl', '20-01-2024'),
        _pedido('estacional@fluvi.cl', '10-02-2024'), _pedido('estacional@fluvi.cl', '18-12-2024'),
        _pedido('estacional@fluvi.cl', '22-01-2025'), _pedido('estacional@fluvi.cl', '15-02-2025'),
    ]
    clientes_inactivos = [{'usuario': 'estacional@fluvi.cl'}]
    resultado = clasificar_churn_estacional(pedidos, clientes_inactivos)
    assert resultado['clientes'][0]['clasificacion'] == 'estacional'


def test_cliente_sin_historial_suficiente_es_real_por_defecto():
    pedidos = [_pedido('nuevo_inactivo@fluvi.cl', '10-01-2026')]
    clientes_inactivos = [{'usuario': 'nuevo_inactivo@fluvi.cl'}]
    resultado = clasificar_churn_estacional(pedidos, clientes_inactivos)
    assert resultado['clientes'][0]['clasificacion'] == 'real'


def test_lista_vacia_no_rompe():
    assert clasificar_churn_estacional([], []) == {'clientes': []}
```

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Implementar**

```python
"""
Servicio de clasificación de churn estacional vs real.

Antes de tratar a un cliente "inactivo" (ya calculado por
customer_risk_service) como perdido para siempre, revisa si su propio
historial completo muestra un patrón de inactividad que se repite en la
misma época todos los años — un cliente así no debería recibir la misma
urgencia que alguien realmente perdido.
"""
import logging
from datetime import datetime
from typing import Dict, List

import pandas as pd

logger = logging.getLogger(__name__)

MIN_ANOS_HISTORIAL = 2
MIN_PEDIDOS_POR_CLIENTE = 3


def _parsear_fecha(fecha_str):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def _es_patron_estacional(fechas: list) -> bool:
    if len(fechas) < MIN_PEDIDOS_POR_CLIENTE:
        return False
    anos = set(f.year for f in fechas)
    if len(anos) < MIN_ANOS_HISTORIAL:
        return False
    # Agrupar meses por año; si los meses activos se repiten consistentemente
    # entre años (mismo trimestre cada año), es estacional.
    meses_por_ano = {}
    for f in fechas:
        meses_por_ano.setdefault(f.year, set()).add((f.month - 1) // 3)  # trimestre 0-3
    trimestres_comunes = set.intersection(*meses_por_ano.values()) if meses_por_ano else set()
    return len(trimestres_comunes) > 0 and len(meses_por_ano) >= MIN_ANOS_HISTORIAL


def clasificar_churn_estacional(pedidos: List[Dict], clientes_inactivos: List[Dict]) -> Dict:
    if not clientes_inactivos:
        return {"clientes": []}

    df = pd.DataFrame(pedidos)
    if not df.empty and 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if not df.empty:
        df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
        df = df.dropna(subset=['fecha_dt'])

    resultado = []
    for cliente in clientes_inactivos:
        usuario = cliente.get('usuario')
        fechas = sorted(df[df['usuario'] == usuario]['fecha_dt'].tolist()) if not df.empty else []
        clasificacion = "estacional" if _es_patron_estacional(fechas) else "real"
        resultado.append({"usuario": usuario, "clasificacion": clasificacion})

    return {"clientes": resultado}
```

- [ ] **Step 4: Correr y confirmar que pasa**

- [ ] **Step 5: Tool en `ai_engine.py`**

```python
    {
        "type": "function",
        "function": {
            "name": "get_seasonal_churn_classification",
            "description": (
                "Clasifica a los clientes inactivos entre 'estacional' (patrón de inactividad "
                "que se repite todos los años en la misma época, ej. vuelve cada verano) y "
                "'real' (perdido sin patrón). Llama cuando el usuario pregunta si un cliente "
                "inactivo realmente se perdió o va a volver."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
```

```python
        if name == "get_seasonal_churn_classification":
            from services.seasonal_churn_service import clasificar_churn_estacional
            from services.customer_risk_service import calcular_riesgo_clientes
            riesgo = calcular_riesgo_clientes(pedidos_cache or [])
            inactivos = [c for c in riesgo.get("clientes", []) if c.get("estado") == "inactivo"]
            return clasificar_churn_estacional(pedidos_cache or [], inactivos)
```

- [ ] **Step 6: Commit**

```bash
git add theycallmebitch/backend/services/seasonal_churn_service.py theycallmebitch/backend/test_seasonal_churn_service.py theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: add seasonal_churn_service, distinguishes customers with a recurring yearly inactivity pattern from genuinely lost ones"
```

---

### Task 18b: Extender `simulate_scenario` con escenarios compuestos

**Files:**
- Modify: `theycallmebitch/backend/services/ai_engine.py` (función `simulate_scenario`, y la definición de la tool en `TOOLS`)

**Interfaces:**
- Produces: `simulate_scenario` acepta un nuevo valor de `action`: `"compound"`, con `params: {escenarios: [{action, params}, ...]}` — ejecuta cada escenario individual con la lógica ya existente y suma/combina sus impactos económicos en un solo resultado, mostrando también el desglose por escenario individual.

- [ ] **Step 1: Leer `simulate_scenario` completo**

Antes de escribir código, leer la función completa en `ai_engine.py` (buscar `def simulate_scenario`) para entender exactamente su firma interna y cómo arma el resultado de cada acción individual (`reactivate_clients`, `add_zone`, etc.), de forma que el escenario compuesto reutilice esa misma lógica sin duplicarla.

- [ ] **Step 2: Escribir el test que falla**

```python
def test_simulate_scenario_compuesto_suma_impactos():
    from services.ai_engine import simulate_scenario
    context = {"ventas_mensuales": 1000000, "pedidos_mensuales": 200}
    resultado = simulate_scenario("compound", {
        "escenarios": [
            {"action": "reactivate_clients", "params": {"pct_reactivated": 0.2}},
            {"action": "increase_frequency", "params": {"extra_orders_per_client": 1, "affected_clients": 10}},
        ]
    }, context)
    assert "desglose" in resultado
    assert len(resultado["desglose"]) == 2
    assert "impacto_total" in resultado
```

- [ ] **Step 3: Correr y verificar que falla**

- [ ] **Step 4: Implementar el caso `"compound"`**

Agregar, dentro de `simulate_scenario`, un branch para `action == "compound"` que itere `params["escenarios"]`, llame recursivamente a `simulate_scenario(sub_action, sub_params, context_data)` por cada uno, junte los resultados en una lista `desglose`, y sume los campos de impacto económico que ya devuelva cada simulación individual (leer qué clave usa cada acción existente para el impacto en CLP antes de sumarlas — probablemente algo como `impacto_clp` o similar, ajustar el nombre exacto según lo que se encuentre en el Step 1).

- [ ] **Step 5: Actualizar la definición de la tool en `TOOLS`**

Agregar `"compound"` al `enum` de `action` (línea ~156-162) y documentar en `params`'s description cómo se arma `escenarios` para este caso.

- [ ] **Step 6: Correr y confirmar que pasa, commit**

```bash
cd theycallmebitch/backend && python -m pytest test_ai_engine_tools.py -v
git add theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: extend simulate_scenario with compound multi-variable scenarios"
```

---

## Fase D — Búsqueda web

### Task 19: Tool `web_search` vía OpenAI Responses API

**Files:**
- Modify: `theycallmebitch/backend/services/ai_engine.py`

**Interfaces:**
- Produces: una nueva función `_buscar_web(query: str) -> dict` que usa `client.responses.create(model=..., tools=[{"type": "web_search"}], input=query)` y devuelve el texto + citas. Se expone como tool `web_search` en el flujo de `_execute_tool`.

- [ ] **Step 1: Investigación previa obligatoria**

Antes de escribir código: confirmar contra la documentación oficial de OpenAI (o experimentando directamente con la API, dado que `openai==2.30.0` ya está instalado) la forma exacta de invocar `web_search` vía la Responses API, y si es necesario mezclarla con las tools de función existentes en la misma conversación o si requiere una llamada separada. Documentar en el reporte de esta tarea la forma real encontrada, porque el resto de los pasos dependen de esto.

- [ ] **Step 2: Escribir el test (con mock, ya que golpea una API externa real)**

```python
from unittest.mock import patch, MagicMock


def test_web_search_tool_devuelve_resultado_estructurado():
    from services.ai_engine import _execute_tool
    with patch("services.ai_engine._buscar_web") as mock_buscar:
        mock_buscar.return_value = {"resultado": "Precio de la competencia: $2200/bidón", "fuentes": ["https://ejemplo.cl"]}
        resultado = _execute_tool("web_search", {"query": "precio bidones agua Puente Alto"}, [], {})
        assert "resultado" in resultado
        assert "fuentes" in resultado
```

- [ ] **Step 3: Implementar `_buscar_web` y la rama en `_execute_tool`**, usando la forma confirmada en el Step 1. Debe manejar el caso de error (sin conexión, sin resultados) devolviendo `{"error": "..."}`, mismo patrón que las demás tools.

- [ ] **Step 4: Agregar la tool a `TOOLS`**

```python
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": (
                "Busca información real y actual en internet — precios de competencia, "
                "noticias económicas locales, o cualquier dato externo que no exista en los "
                "datos propios del negocio. Llama SOLO cuando la pregunta requiere información "
                "que no está en ninguna otra tool disponible."
            ),
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "Consulta de búsqueda."}},
                "required": ["query"],
            },
        },
    },
```

- [ ] **Step 5: Correr el test, verificar en vivo con una consulta real** (una sola, para no gastar de más), commit

```bash
cd theycallmebitch/backend && python -m pytest test_ai_engine_tools.py -v
git add theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: add web_search tool via OpenAI's native Responses API for external context not present in business data"
```

---

## Fase E — Trazabilidad

### Task 20: Regla de trazabilidad en los prompts

**Files:**
- Modify: `theycallmebitch/backend/services/ai_engine.py` (`SYSTEM_PROMPT`, `CHAT_PROMPT`)

**Interfaces:** ninguna nueva — cambio de texto en los prompts existentes.

- [ ] **Step 1: Agregar la regla al `CHAT_PROMPT`**

Agregar, en la sección de `REGLAS` (o crear una si `CHAT_PROMPT` no tiene una sección de reglas explícita — verificar leyendo el prompt completo primero), una regla nueva:

```
- TRAZABILIDAD OBLIGATORIA: cada vez que menciones un número o una recomendación,
  indica brevemente de qué cálculo salió (ej. "según la cadencia personal de este
  cliente, calculada sobre sus últimos N pedidos..." o "comparando pedidos con y sin
  descuento en Portezuelo..."). Nunca presentes un número sin decir de dónde sale.
```

- [ ] **Step 2: Verificar en vivo**

Hacer 3 preguntas distintas al chat que disparen tools distintas (ej. clientes en riesgo, pronóstico de demanda, descuento por volumen) y confirmar manualmente que las respuestas mencionan la fuente del cálculo, no solo el número pelado.

- [ ] **Step 3: Commit**

```bash
git add theycallmebitch/backend/services/ai_engine.py
git commit -m "feat: require the chat to state which real calculation backs every number it mentions"
```

---

## Fase F — Absorción de "Modo CEO-Dios"

### Task 21: Eliminar el panel fijo de Home, briefing como saludo del chat

**Files:**
- Modify: `theycallmebitch/frontend/src/pages/Home.jsx` (quitar la sección/import de `InsightsPanel`)
- Delete: `theycallmebitch/frontend/src/components/InsightsPanel.jsx`
- Modify: `theycallmebitch/frontend/src/components/ChatAssistant.jsx` (mostrar el briefing como primer mensaje al abrir)

**Interfaces:**
- Consumes: `GET /briefing` (ya existe, cacheado una vez al día vía `obtener_briefing_hoy` — no se modifica el backend en esta tarea).

- [ ] **Step 1: Confirmar que `InsightsPanel` no se usa en ningún otro lado**

```bash
grep -rn "InsightsPanel" theycallmebitch/frontend/src/ --include="*.jsx"
```

Expected: solo el import en `Home.jsx` y la propia definición.

- [ ] **Step 2: Quitar el import y el uso en `Home.jsx`**

Leer `Home.jsx` completo primero para ubicar exactamente dónde se importa y renderiza `InsightsPanel`, y quitar ambos sin afectar el resto del layout de la página (las demás cards de KPIs quedan igual).

- [ ] **Step 3: Borrar el archivo**

```bash
git rm theycallmebitch/frontend/src/components/InsightsPanel.jsx
```

- [ ] **Step 4: Mostrar el briefing como primer mensaje del chat**

En `ChatAssistant.jsx`, al abrir el chat (`isOpen` pasa a `true`) por primera vez en la sesión, si `messages` está vacío, hacer un `fetch` a `${API}/briefing` y mostrar su contenido como el primer mensaje del rol `agent`, antes de que el usuario escriba nada — mismo dato que antes mostraba el panel fijo, ahora como saludo.

- [ ] **Step 5: Verificar en el navegador**

Confirmar que Home ya no muestra el panel "Modo CEO-Dios", y que al abrir el chat por primera vez aparece el briefing del día como primer mensaje.

- [ ] **Step 6: Commit**

```bash
git add theycallmebitch/frontend/src/pages/Home.jsx theycallmebitch/frontend/src/components/ChatAssistant.jsx
git commit -m "refactor: remove the fixed 'Modo CEO-Dios' panel from Home, daily briefing now shows as the chat's first message instead"
```

---

### Task 22: Reformar el loop autónomo (anomalía real antes de llamar a OpenAI) + badge de notificación

**Files:**
- Modify: `theycallmebitch/backend/main.py` (`ai_autonomous_loop`)
- Modify: `theycallmebitch/frontend/src/components/ChatAssistant.jsx` (badge en el ícono flotante)

**Interfaces:**
- Consumes: `anomaly_detection_service.detectar_anomalias(pedidos)` (Task 10).

- [ ] **Step 1: Escribir el test que falla (backend)**

Dado que `ai_autonomous_loop` es un loop infinito async, testear su lógica de decisión extrayéndola a una función separada y testeable:

```python
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
```

(Crear `theycallmebitch/backend/test_main_ai_loop.py` para estos tests.)

- [ ] **Step 2: Correr y verificar que falla** (la función `_decidir_si_generar_insight` no existe todavía).

- [ ] **Step 3: Extraer y reformar la lógica en `main.py`**

Crear una función nueva:

```python
def _decidir_si_generar_insight(pedidos: list, generar_insight_fn, context: dict) -> list:
    """Solo llama a OpenAI (generar_insight_fn) si anomaly_detection_service
    encuentra una desviación real — evita el costo de una llamada incondicional."""
    from services.anomaly_detection_service import detectar_anomalias
    anomalias = detectar_anomalias(pedidos)
    if not anomalias:
        return []
    return generar_insight_fn(context)
```

Modificar `ai_autonomous_loop` para usar esta función en vez de llamar a `run_autonomous_insight` directo:

```python
        while True:
            try:
                await asyncio.sleep(900)
                context = _build_full_context()
                pedidos = data_adapter.obtener_pedidos_combinados()
                nuevas_alertas = _decidir_si_generar_insight(pedidos, run_autonomous_insight, context)
                if nuevas_alertas:
                    GLOBAL_INSIGHTS = (nuevas_alertas + GLOBAL_INSIGHTS)[:8]
                    for insight in nuevas_alertas:
                        guardar_insight(insight, context)
                    logger.info(f"AI CEO generó {len(nuevas_alertas)} nuevos insights.")
                guardar_snapshot_kpis(context)
            except Exception as e:
                logger.error(f"Error en AI CEO Loop: {e}")
```

(Mismo tratamiento para la "primera pasada inmediata" al inicio de la función — también debe pasar por `_decidir_si_generar_insight` en vez de llamar a `run_autonomous_insight` directo.)

- [ ] **Step 4: Correr y confirmar que pasa**

- [ ] **Step 5: Badge de notificación en el ícono del chat**

En `ChatAssistant.jsx`, cuando `GLOBAL_INSIGHTS` (expuesto ya sea vía un endpoint existente o uno nuevo — verificar si `/insights` ya devuelve esto, leyendo el endpoint completo antes de decidir) tiene contenido nuevo desde la última vez que el usuario abrió el chat, mostrar un badge (número o punto) sobre el ícono flotante — mismo patrón visual que la campanita de notificaciones ya usada en la página de Clientes.

- [ ] **Step 6: Verificar en vivo**

Forzar una anomalía en datos de prueba (o esperar a que ocurra una real) y confirmar que el badge aparece; confirmar que en un día sin anomalías el loop no genera contenido nuevo (revisar logs: no debe aparecer "AI CEO generó N nuevos insights" si `anomaly_detection_service` no detectó nada).

- [ ] **Step 7: Commit**

```bash
git add theycallmebitch/backend/main.py theycallmebitch/backend/test_main_ai_loop.py theycallmebitch/frontend/src/components/ChatAssistant.jsx
git commit -m "refactor: gate the autonomous insight loop behind real anomaly detection instead of calling OpenAI unconditionally every 15 minutes; surface real anomalies as a notification badge on the chat icon"
```

---

## Fase G — Revisión final

### Task 23: Verificación end-to-end de todo el módulo

- [ ] **Step 1: Correr toda la suite de tests del agente**

```bash
cd theycallmebitch/backend
python -m pytest test_ai_engine_tools.py test_discount_analysis_service.py test_route_intelligence_service.py test_anomaly_detection_service.py test_opportunity_service.py test_margin_leak_service.py test_payment_risk_service.py test_channel_comparison_service.py test_building_opportunity_service.py test_sla_compliance_service.py test_activation_service.py test_seasonal_churn_service.py test_main_ai_loop.py -v
```

Expected: todos PASS.

- [ ] **Step 2: Correr la suite completa del backend (no solo lo nuevo) para confirmar cero regresiones**

```bash
python -m pytest -v
```

- [ ] **Step 3: Verificar en vivo, en el navegador, con el chat real**: hacer al menos una pregunta que dispare cada una de las 11 tools nuevas más las 3 de la Fase B, confirmar que ninguna devuelve un error de conexión, que las respuestas mencionan de dónde sale el número (Task 20), que el botón "¿Lo ejecutaste?" funciona, que Home ya no tiene el panel fijo, y que el chat muestra el briefing al abrirse por primera vez.

- [ ] **Step 4: Confirmar que no queda ninguna mención de "Chiloé" ni de `ELASTICITY = -0.3` usada como valor real**, y que `INTERNAL_API_URL`/`localhost:8000` ya no aparecen en `ai_engine.py`.
