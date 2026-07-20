# Rediseño del Agente de IA (CEO Virtual) — Diseño

Fecha: 2026-07-20
Estado: aprobado por el usuario, pendiente de plan de implementación

## Contexto

Auditoría completa del módulo de IA (`services/ai_engine.py`, `business_context.py`,
`memory_service.py`, `briefing_service.py`, `ChatAssistant.jsx`, `InsightsPanel.jsx`)
encontró que el chat **sí llama a OpenAI de verdad** (GPT-4o-mini con function
calling real sobre datos reales de RFM/zonas/KPIs) — no es un simulacro — pero
tiene bugs que comprometen la confianza en lo que responde, y capacidades reales
del backend que nunca se conectaron al chat.

### Bugs encontrados (a corregir como base)

- `get_daily_cashflow` y `get_inventory` (`ai_engine.py:913-929`) llaman a su
  propio servidor por HTTP a `http://localhost:8000` — puerto que ni siquiera
  es el real en producción (Render asigna uno dinámico). Estas dos
  herramientas fallan silenciosamente en producción.
- Si la llamada a OpenAI falla, el texto crudo de la excepción se devuelve
  como si fuera la respuesta del CEO (`ai_engine.py:1020-1022`,
  `main.py:788,797`) — el dueño vería un error de rate-limit de OpenAI
  disfrazado de análisis estratégico.
- El loop autónomo en segundo plano (`main.py:728-758`) llama a OpenAI cada
  15 minutos para siempre, desde que arranca el servidor, sin relación con
  el uso real del dashboard — costo no controlado.
- `/briefing` dispara una llamada real a OpenAI automáticamente la primera
  vez que se abre Home cada día, sin ningún aviso visible de que eso pasó.
- Inconsistencia de identidad: el chat/insights dice que la empresa está en
  "Puente Alto, Santiago" (`ai_engine.py:284-330`); el briefing diario dice
  "Chiloé" (`briefing_service.py:14`). Dos prompts, dos versiones de dónde
  opera el negocio.
- El botón "¿Lo ejecutaste? Sí/No" en el chat nunca funciona: el backend
  genera y guarda un `rec_id` real (`memory_service.py:242-244`) pero nunca
  lo manda de vuelta en la respuesta del chat, así que
  `ChatAssistant.jsx`'s `feedbackId` siempre queda en `null` y el botón no
  hace nada.
- `ai_engine.py:19` tiene una constante **inventada**:
  `ELASTICITY = -0.3  # elasticidad precio-demanda (agua = bien básico)` —
  usada hoy en `simulate_scenario` para simular cambios de precio. Es
  exactamente el tipo de número no-verificable que este rediseño busca
  eliminar.
- `zone_engine.py`/`business_context.py` usan un modelo de 3 zonas
  hardcodeadas (`puente_alto`, `la_florida`, `macul`) con distancias fijas
  a mano (`DISTANCIAS_KM`) — desactualizado ahora que existe geocoding real
  (lat/lon) de la mayoría de los pedidos, construido para el Mapa de Calor.

### Lo que ya funciona bien (no se toca)

`run_chat_query`/`run_chat_query_prepare` llaman a OpenAI de verdad con tool
calling real; `simulate_scenario` es aritmética pura, honestamente
etiquetada como tal; la memoria histórica (`memory_service.py`) se lee y se
usa de verdad, no es solo escritura; no hay exposición de la API key al
frontend.

## Objetivo

1. Corregir los bugs de la lista anterior.
2. Conectar al chat motores reales que ya existen pero nunca se conectaron.
3. Construir un conjunto nuevo de análisis, todos con cálculo real
   verificable (no estimaciones del modelo) sobre los datos reales del
   negocio.
4. Absorber el panel "Modo CEO-Dios" (`InsightsPanel.jsx`, sección fija en
   Home) dentro del chat — decisión del usuario, confirmada explícitamente
   ("ese apartado completo siempre tuvo poco sentido").

## Principio rector

**Todo consejo debe salir de cálculo real sobre datos reales, nunca de
estimación del modelo.** Mismo estándar que ya se aplicó en Predictor
(XGBoost + validación walk-forward) y Clientes (cadencia personal +
probabilidad empírica). El modelo de lenguaje decide **qué** calcular y
**cómo comunicarlo** — nunca inventa el número.

## Arquitectura

### A. Correcciones de base

- **`get_daily_cashflow` y `get_inventory` dejan de auto-llamarse por
  HTTP.** Llaman directo a las funciones Python que ya usan esos endpoints
  (mismo patrón que las demás tools, que sí llaman servicios directamente).
  Esto elimina la clase de bug del puerto por completo, no solo el síntoma
  actual.
- **Ubicación única del negocio**: una constante
  `UBICACION_EMPRESA` en `business_context.py`, inyectada en todos los
  prompts (`SYSTEM_PROMPT`, `CHAT_PROMPT` de `ai_engine.py`, y el prompt de
  `briefing_service.py`) — se elimina la contradicción Puente Alto/Chiloé.
- **Errores estructurados**: toda ruta de chat (`/chat`, `/chat/stream`)
  envuelve fallas de OpenAI en `{"error": true, "mensaje": "..."}` en vez
  de devolver el texto crudo de la excepción. `ChatAssistant.jsx` renderiza
  ese caso visualmente distinto (ícono de advertencia, no burbuja normal
  del "CEO").
- **El botón "¿Lo ejecutaste?" funciona**: `/chat` y `/chat/stream`
  incluyen `rec_id` en el payload de respuesta/evento SSE cuando
  `guardar_recomendacion` generó uno, para que `ChatAssistant.jsx` deje de
  recibir siempre `null`.
- **`ELASTICITY = -0.3` se reemplaza** por el valor real calculado por el
  análisis de descuento por volumen (sección C) — `simulate_scenario`'s
  `price_change` deja de usar un número inventado.

### B. Conectar motores reales ya existentes (bajo riesgo, mecánico)

Tres tools nuevas para `ai_engine.py`, mismo patrón de `TOOLS`/`_execute_tool`
que las 8 actuales:

- `get_customer_risk` → envuelve `customer_risk_service.calcular_riesgo_clientes`
  (cadencia personal, probabilidad de reorden, valor en juego — más preciso
  que el RFM genérico que ya expone `get_customer_segments`).
- `get_demand_forecast` → envuelve `demand_forecast_service.predecir_proximos_dias`
  + `validar_precision` (el mismo modelo XGBoost del Predictor).
- `get_rentabilidad_reportes` → envuelve la lógica de `/rentabilidad/avanzado`
  y `/reportes/ejecutivo` (ya reales en `main.py`, nunca conectados a
  ningún componente de UI — este es el punto donde se cumple el plan
  pendiente de "conectar esto al agente en vez de armar una card").

### C. Servicios nuevos a construir

Cada uno es un archivo `services/*.py` autocontenido con su propia función
de cálculo + tests, mismo patrón que `customer_risk_service.py`/
`rfm_engine.py`/`customer_profile_service.py` construidos esta sesión. Cada
uno se expone como una tool nueva en `ai_engine.py`.

1. **`discount_analysis_service.py`** — compara pedidos con descuento por
   volumen (ej. Portezuelo: 3 bidones × \$5.000) vs pedidos sin descuento,
   dentro de la misma zona: frecuencia de recompra, cantidad promedio por
   pedido, retención. Produce el valor real que reemplaza `ELASTICITY`.
2. **`route_intelligence_service.py`** — reemplaza el modelo de 3 zonas
   hardcodeadas por clustering geográfico real sobre lat/lon (reutiliza el
   caché de `geocoding_service.py` ya construido para el Mapa de Calor).
   Detecta zonas con alta densidad de pedidos mal servidas.
3. **`anomaly_detection_service.py`** — detección estadística de
   desviaciones reales (caída de pedidos no explicada por el patrón
   normal, salto de churn, etc.) sobre la serie diaria de pedidos.
   Alimenta el loop autónomo reformado (ver sección F).
4. **`opportunity_service.py`** — espejo de `customer_risk_service`: detecta
   clientes cuya frecuencia/ticket promedio **aumentó** recientemente
   (señal de crecimiento, no de riesgo).
5. **`margin_leak_service.py`** — cruza costos reales + zonas +
   combustible: identifica zonas donde el costo de combustible por pedido
   entregado es desproporcionado a la densidad de pedidos.
6. **`payment_risk_service.py`** — correlaciona método de pago
   (transferencia/efectivo/tarjeta) con tasa de cancelación/mora.
7. **`channel_comparison_service.py`** — compara Local (mostrador) vs
   Delivery: ¿un canal compensa caídas del otro, o caen juntos?
8. **`building_opportunity_service.py`** — agrupa pedidos por dirección
   exacta (no por email, que puede ser distinto por pedido) para detectar
   edificios/condominios con múltiples clientes individuales — oportunidad
   de contrato mayorista único.
9. **`sla_compliance_service.py`** — % de pedidos entregados dentro de la
   ventana horaria prometida (`horaagenda` vs hora real de entrega), por
   zona. (Alcance confirmado por el usuario: solo el % de cumplimiento,
   **no** un scoring general de desempeño por repartidor.)
10. **`activation_service.py`** — de los clientes nuevos, qué porcentaje
    hace una segunda compra y en cuánto tiempo — diagnóstico de conversión
    del primer pedido, distinto de churn (que mide a clientes existentes).
11. **`seasonal_churn_service.py`** — detecta clientes cuyo patrón de
    inactividad se repite en la misma época todos los años (estacional)
    vs. churn real — para no tratar igual a alguien que "siempre vuelve en
    verano" que a alguien realmente perdido.

`simulate_scenario` se extiende (no es archivo nuevo) para aceptar
escenarios compuestos (múltiples variables cruzadas, ej. "contratar 1
repartidor + expandir a zona X").

### D. Búsqueda web

Tool nueva `web_search`, usando la búsqueda web nativa de OpenAI (API de
Responses — compatible con `openai==2.30.0`, ya instalado). Para contexto
externo real y verificable que no existe en los datos propios: precios de
competencia, noticias económicas locales relevantes. El plan de
implementación debe decidir si esto implica migrar el loop de tool-calling
completo a la API de Responses (recomendado por ser hacia donde OpenAI
consolida function calling + hosted tools en una sola llamada) o puentear
una llamada separada solo cuando el modelo pide búsqueda web.

### E. Trazabilidad

No es una tool nueva — es una regla de sistema: cada tool debe devolver,
junto con el número, de qué cálculo salió (ej. "sobre los últimos 12
pedidos de este cliente"), y el `SYSTEM_PROMPT`/`CHAT_PROMPT` exige que la
respuesta lo mencione en lenguaje natural, no solo internamente.

### F. Absorción de "Modo CEO-Dios"

- Se elimina `InsightsPanel.jsx` como sección fija de Home.
- El briefing diario (mismo cálculo, mismo cache de una vez al día vía
  `obtener_briefing_hoy`) pasa a mostrarse como primer mensaje del chat al
  abrirlo, no como panel siempre visible.
- Las anomalías reales detectadas por `anomaly_detection_service` (sección
  C.3) se muestran como badge de notificación en el ícono flotante del
  chat — mismo patrón visual que la campanita de notificaciones ya usada
  en Clientes — en vez de un panel que regenera contenido cada 15 minutos
  sin relación con el uso real.
- El loop autónomo de `main.py:728-758` se reforma: en vez de llamar a
  OpenAI incondicionalmente cada 15 minutos, primero corre
  `anomaly_detection_service` (cálculo puro, sin costo de API); solo si
  detecta una desviación real, entonces sí llama a OpenAI para redactar la
  alerta. Resuelve el hallazgo crítico #3 de la auditoría (costo no
  controlado) dándole al loop un propósito real en vez de eliminarlo.

## Fuera de alcance (explícitamente pospuesto)

- **Recomendador de expansión de mayoristas** (identificar candidatos y
  simular ROI de precio) — pospuesto hasta que el usuario confirme cuáles
  son sus 4 mayoristas reales; la detección automática por ratio de precio
  resultó no confiable (296 clientes distintos con ratios entre \$118 y
  \$1.200 por bidón, ruido del campo `ordenpedido`, no señal limpia).
- **Rendimiento general por repartidor** (ratings, atrasos, volumen) —
  descartado explícitamente por el usuario; solo se construye el % de
  cumplimiento de horario (`sla_compliance_service`, punto C.9).
- **Reconstrucción del inventario con widget de registro manual** — ya
  planificado por separado (ver memoria `project-inventario-agente-pendiente`).
  `get_inventory` se corrige en el puerto (sección A) pero su cálculo de
  fondo espera esa reconstrucción.
- **Ejecutar acciones automáticamente** (enviar campañas/reportes sin
  confirmación) — el usuario no tiene aún la infraestructura operativa
  para esto; `draft_campaign_message` sigue siendo solo redacción.

## Testing

- Cada servicio nuevo de la sección C sigue el mismo patrón de tests que
  `customer_risk_service`/`customer_profile_service`: casos reales,
  casos límite (sin datos suficientes, un solo pedido, etc.), sin mocks
  de la lógica de negocio.
- Verificar en vivo que `get_daily_cashflow`/`get_inventory` responden sin
  el error de puerto tras el fix de la sección A.
- Verificar que un fallo forzado de OpenAI (ej. API key inválida
  temporalmente) produce el error estructurado, no el texto crudo de la
  excepción, en `/chat` y `/chat/stream`.
- Verificar que el botón "¿Lo ejecutaste?" efectivamente actualiza el
  registro en `agent_memory.db` tras el fix del `rec_id`.
- Verificar que el loop autónomo reformado NO llama a OpenAI cuando
  `anomaly_detection_service` no detecta nada, y SÍ lo hace cuando se
  fuerza una anomalía real en datos de prueba.
