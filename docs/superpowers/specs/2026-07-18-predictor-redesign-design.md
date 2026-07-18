# Rediseño del módulo Predictor — Diseño

Fecha: 2026-07-18
Estado: aprobado por el usuario, pendiente de plan de implementación

## Contexto

El módulo Predictor actual (`frontend/src/pages/Predictor.jsx` + lógica inline
en `backend/main.py`) es confuso e inutilizable según el propio dueño del
negocio ("es un módulo fantasma, no se entiende, es difícil de ocupar, no lo
entiendo ni yo que lo programé"). Problemas confirmados por auditoría previa:

- Requiere que el usuario llene un formulario manual (fecha + tipo de
  cliente) antes de mostrar cualquier predicción — fricción innecesaria.
- El "Análisis de Clientes VIP" está hardcodeado en ceros siempre
  (`main.py:1531-1538`) — existe una función real (`analizar_clientes_vip`)
  que lo calcularía, pero nunca se invoca.
- La sección "Predicción de Bidones" nunca puede aparecer: el frontend
  espera un campo `prediccion_bidones` que el backend nunca envía.
- El botón "Registrar Pedidos Reales" no persiste nada — solo hace un log.
- Hay 11 archivos sueltos (`predictor_*.py`, `entrenar_*.py`,
  `ml_predictor.py`, `mejoras_predictor.py`, `mejorar_predictor.py`) en la
  raíz de `backend/` que **no están conectados a nada** — código muerto
  confirmado por grep exhaustivo de imports.
- Existe un segundo modo "Predictor Clásico" que duplica funcionalidad de
  forma inconsistente con el modo "inteligente".
- El único endpoint realmente vivo (`/predictor-inteligente` +
  `/factores-prediccion` + `/validacion-predictor`) usa una fórmula de
  factores heurísticos ajustados a mano, no un modelo estadístico/ML real.

Datos disponibles (verificado en vivo):
- 3.609 pedidos de Aguas Ancud, 2024-10-30 a 2026-07-17 (~21 meses).
- Promedio 5.8 pedidos/día histórico, pero con tendencia de crecimiento
  clara (el ritmo actual es más alto que el promedio histórico completo).
- Features reales disponibles: fecha, precio, usuario, dirección
  (geocodificada — ver trabajo de Mapa de Calor), clima real vía
  `services/weather_service.py` (Open-Meteo, sin costo).
- Ya existe un motor RFM funcional y probado: `services/rfm_engine.py`
  (Recency/Frequency/Monetary, 8 segmentos con umbral de churn por segmento).

## Objetivo

Reemplazar el módulo completo por dos vistas claras en una sola página, sin
formularios manuales, con dos preguntas de negocio bien definidas:

1. **¿Cuánta demanda voy a tener?** (pronóstico de pedidos/bidones/ventas)
2. **¿Qué clientes van a comprar pronto o se me van a ir?** (riesgo de churn,
   accionable)

## Arquitectura

### 1. Pronóstico de demanda — XGBoost

**Por qué XGBoost y no algo más simple:** con ~600 puntos diarios de
historial y varias señales reales (calendario, clima, tendencia), XGBoost es
apropiado — no hay volumen para deep learning, pero sí para gradient
boosting sobre features tabulares. Se descarta un modelo más simple
(regresión lineal / promedio móvil) porque no capturaría bien la
interacción entre día de semana, clima y tendencia de crecimiento.

**Features de entrenamiento** (una fila por día, ~625 días):
- Rezagos: promedio de pedidos de los últimos 7, 14 y 30 días.
- Calendario: día de la semana, día del mes, mes, si es fin de semana.
- Clima: temperatura del día (real, vía `weather_service`).
- Tendencia: día ordinal desde el inicio del historial (captura que el
  negocio está creciendo, para que el modelo no subestime meses de
  crecimiento fuerte).

**Salida:** no un solo número — tres modelos de cuantiles (P10, P50, P90)
entrenados con `objective='reg:quantileerror'` de XGBoost, para dar un
rango honesto ("entre 4 y 9 pedidos, más probable 6") en vez de una falsa
precisión.

**Horizonte:** predicción día por día para los próximos 7 días. La
"proyección de fin de mes" se arma sumando: ventas reales ya ocurridas este
mes + la suma de las predicciones diarias (P10/P50/P90) para los días
restantes del mes.

**Validación de precisión (real, no inventada):** *walk-forward validation*
— para cada uno de los últimos 30 días, se entrena el modelo solo con datos
anteriores a esa fecha y se predice ese día puntual, comparando contra lo
que realmente pasó. Se reporta el error porcentual promedio (MAPE) como
badge: "±X% de margen en los últimos 30 días". Este cálculo reemplaza
conceptualmente a `validacion_cruzada_predictor` actual, pero contra el
modelo XGBoost real en vez de la fórmula heurística.

**Reentrenamiento:** en cada request al endpoint (dataset es pequeño, entrena
en menos de un segundo). No hay modelo serializado que pueda desactualizarse
— siempre usa los pedidos reales más recientes, igual que el resto del
sistema.

### 2. Clientes en riesgo — RFM + Markov personalizado

**Base:** se reutiliza `services/rfm_engine.py::calcular_rfm()` tal cual —
ya calcula recencia/frecuencia/monetario y segmento por cliente
correctamente. No se reescribe desde cero.

**Mejora 1 — cadencia personal:** en vez de comparar la recencia de cada
cliente contra un umbral fijo por segmento (`churn_dias` genérico), se
calcula el intervalo típico de compra de CADA cliente (mediana de días
entre sus propios pedidos, cuando tiene 2+ pedidos). Un cliente se marca
"en riesgo" cuando su atraso actual supera su propio patrón habitual, no un
número igual para todos. Clientes con un solo pedido histórico usan el
umbral genérico del segmento RFM como respaldo (no hay cadencia propia que
calcular).

**Mejora 2 — probabilidad empírica (capa Markov):** se calculan, sobre el
historial real, las frecuencias de transición entre estados
(Activo → En riesgo → Inactivo → reactivado) agrupadas por segmento RFM y
por cuánto se atrasó el cliente respecto a su cadencia personal. Con eso se
estima "probabilidad de volver a comprar en los próximos 15 días" por
cliente — una frecuencia observada real, no una regla inventada.

**Mejora 3 — priorización por valor en juego:** la tabla de clientes en
riesgo se ordena por `(1 - probabilidad_reorden) × monetario_promedio` — se
prioriza a quién más impacta el negocio si se pierde, no solo a quién lleva
más días sin comprar.

**Validación de precisión:** de los clientes marcados "en riesgo" hace 30
días, qué porcentaje efectivamente no volvió a comprar (o si volvió,
confirmando que el modelo también acierta en falsos positivos). Se muestra
como badge similar al de demanda.

### Endpoints backend (reemplazan a los actuales)

- `GET /predictor/demanda` → `{ manana: {p10,p50,p90}, dias_7: [...],
  proyeccion_mes: {actual, p10, p50, p90, meta}, precision_historica_pct }`
- `GET /predictor/clientes-riesgo` → `{ resumen: {activos, en_riesgo,
  inactivos}, clientes: [{nombre, telefono, ultima_compra, dias_atraso,
  cadencia_personal_dias, monetario_promedio, probabilidad_reorden,
  prioridad}], precision_historica_pct }`

Ambos endpoints filtran a Aguas Ancud (mismo criterio `nombrelocal` usado en
el resto del sistema) y no requieren parámetros de entrada.

### Dependencias nuevas

`xgboost` y `scikit-learn` (para el split de validación) — no están
instalados, hay que agregarlos a `requirements.txt` e instalarlos.

## Frontend

Página única (`Predictor.jsx` reescrito completo), sin formulario manual,
carga automática al entrar — mismo patrón que el resto del dashboard
(fetch en `useEffect`, refresco automático cada 10 min + evento
`globalRefresh`).

Layout (ya aprobado por el usuario):

```
Predictor
Qué esperar los próximos días, y a quién no perder
─────────────────────────────────────────
DEMANDA ESPERADA                    [±X% de margen, últimos 30 días]
[Mañana: rango grande]  [Gráfico 7 días con banda P10-P90]
Proyección fin de mes: [rango] (meta: [monto])
─────────────────────────────────────────
CLIENTES EN RIESGO                  [precisión histórica]
[Activos] [En riesgo] [Inactivos]
Tabla: Cliente | Última compra | Atraso vs su cadencia | Gasto promedio | Prioridad
(ordenada por prioridad descendente)
```

Mismo lenguaje visual del resto del dashboard: tarjetas de vidrio
(`glassCardSx` / patrón de `FinancialKpiCard`), acento cian `#06b6d4`,
tipografías "Plus Jakarta Sans" (headings) / "DM Sans" (body).

## Qué se elimina

- `backend/predictor_simple.py`, `predictor_avanzado.py`,
  `predictor_ultra_simple.py`, `predictor_simple_efectivo.py`,
  `ml_predictor.py`, `mejoras_predictor.py`, `mejorar_predictor.py`,
  `entrenar_predictor.py`, `entrenar_predictor_final.py`,
  `entrenar_predictor_simple.py`, `entrenar_manual.py` — código muerto
  confirmado, no importado por nada.
- Los archivos `.json` de resultados congelados que estos scripts generaban
  (`predictor_simple_resultados.json`, `factores_entrenados.json`,
  `efectividad_predictor.json`, `predictor_tracking.json`,
  `predictor_mejorado.json`, `predictor_inteligente_resultados.json`,
  `predictor_ultra_simple_resultados.json`).
- Endpoints viejos en `main.py`: `/predictor-inteligente`,
  `/factores-prediccion`, `/validacion-predictor`, `/tracking/*` y las
  funciones que solo ellos usaban (`calcular_factores_dinamicos_avanzados`,
  `predecir_inteligente_avanzado`, `validacion_cruzada_predictor`,
  `analizar_clientes_vip` si no se reutiliza tal cual, `procesar_variables_exogenas`).
- `frontend/src/components/PrediccionCumplimientoCard.jsx` (importado pero
  nunca renderizado).
- Función `getValidacionPredictor` en `api.js` (definida pero nunca
  llamada).
- Modo "Predictor Clásico" y el formulario manual de fecha/tipo de cliente.

## Fuera de alcance (explícitamente pospuesto)

Desglose de demanda por zona/comuna — ahora es técnicamente posible gracias
al geocoding real agregado al Mapa de Calor, pero el usuario pidió dejarlo
pendiente para una fase futura, no incluirlo en este rediseño.

## Testing

- Backend: verificar con `curl` que ambos endpoints responden en tiempo
  razonable (<3s, el entrenamiento de XGBoost sobre ~625 filas debería ser
  casi instantáneo) y que los números son coherentes (p10 ≤ p50 ≤ p90,
  proyección de mes ≥ ventas ya realizadas este mes).
- Verificar visualmente en navegador (`/predictor`) que ambas secciones
  cargan sin formulario manual, con datos reales, y que la tabla de riesgo
  está ordenada por prioridad.
- Confirmar que ninguna otra parte del frontend importa los componentes/
  funciones eliminados (grep antes de borrar).
