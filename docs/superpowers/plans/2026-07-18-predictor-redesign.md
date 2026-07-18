# Rediseño del módulo Predictor — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el módulo Predictor actual (confuso, con código muerto y
lógica hardcodeada) por dos vistas claras: pronóstico de demanda (XGBoost,
rango P10-P90, 7 días + proyección de mes) y clientes en riesgo (cadencia
personal por cliente + probabilidad empírica de reorden, priorizados por
valor en juego).

**Architecture:** Dos servicios backend nuevos y autocontenidos
(`demand_forecast_service.py`, `customer_risk_service.py`), dos endpoints
FastAPI nuevos que los exponen, y un frontend de una sola página sin
formularios manuales que consume ambos. Se elimina toda la lógica y los
archivos predictor_* actuales que no están conectados a nada.

**Tech Stack:** Python (FastAPI, pandas, XGBoost, pytest), React (MUI,
Recharts), reutilizando `services/rfm_engine.py` como referencia de patrón
(no se modifica) y `services/weather_service.py` para temperatura real.

## Global Constraints

- Todo filtro de pedidos debe usar `nombrelocal == 'Aguas Ancud'` (mismo
  criterio que el resto del backend) — spec, sección "Endpoints backend".
- Ningún endpoint nuevo requiere parámetros de entrada obligatorios (sin
  formulario manual) — spec, sección "Frontend".
- El modelo se reentrena en cada request, no se serializa a disco — spec,
  sección "Reentrenamiento".
- P10 ≤ P50 ≤ P90 siempre en la salida del pronóstico de demanda — spec,
  sección "Salida".
- La lista de clientes en riesgo se ordena por
  `(1 - probabilidad_reorden) * gasto_promedio` descendente — spec, sección
  "Mejora 3".
- Mismo lenguaje visual del resto del dashboard: `glassCardSx` de
  `frontend/src/utils/glassCard.js`, acento `#06b6d4`, fuentes "Plus
  Jakarta Sans" (headings) / "DM Sans" (body) — spec, sección "Frontend".
- Desglose por zona/comuna queda explícitamente fuera de alcance — spec,
  sección "Fuera de alcance".

---

## Task 1: Instalar dependencias nuevas (xgboost, scikit-learn)

**Files:**
- Modify: `theycallmebitch/backend/requirements.txt`

**Interfaces:**
- Produces: `xgboost` y `scikit-learn` disponibles para importar en el resto
  de las tareas.

- [ ] **Step 1: Agregar las dependencias**

Abrir `theycallmebitch/backend/requirements.txt` y agregar al final:

```
xgboost>=2.0.0
scikit-learn>=1.3.0
```

- [ ] **Step 2: Instalar y verificar**

Run: `python -m pip install xgboost>=2.0.0 scikit-learn>=1.3.0`

Run: `python -c "from xgboost import XGBRegressor; import sklearn; print('ok', sklearn.__version__)"`

Expected: `ok <version>` sin errores de import.

- [ ] **Step 3: Commit**

```bash
cd theycallmebitch/backend
git add requirements.txt
git commit -m "chore: add xgboost and scikit-learn for predictor rebuild"
```

---

## Task 2: `demand_forecast_service.py` — serie diaria, features y entrenamiento

**Files:**
- Create: `theycallmebitch/backend/services/demand_forecast_service.py`
- Test: `theycallmebitch/backend/test_demand_forecast_service.py`

**Interfaces:**
- Consumes: nada de otras tareas (autocontenido).
- Produces (usado por Task 3 y Task 5):
  - `construir_serie_diaria(pedidos: List[Dict]) -> pd.DataFrame` — columnas
    `fecha` (date), `pedidos` (int).
  - `agregar_features(serie: pd.DataFrame, temperaturas_por_fecha: Dict = None) -> pd.DataFrame`
    — agrega columnas `dow, dom, month, is_weekend, lag7, lag14, lag30, temp, trend_day`.
  - `FEATURES: List[str]` — lista de nombres de columnas de features, en
    orden, usada para entrenar y predecir.
  - `predecir_proximos_dias(pedidos: List[Dict], dias: int = 7, temperaturas_futuras: Dict = None) -> List[Dict]`
    — cada dict: `{fecha: str, p10: float, p90: float, p10: float}` (p10 ≤ p50 ≤ p90).

- [ ] **Step 1: Escribir los tests (fallando)**

Crear `theycallmebitch/backend/test_demand_forecast_service.py`:

```python
"""Tests para demand_forecast_service. Usa datos sintéticos deterministas,
no llama a ninguna API externa."""
from datetime import datetime, timedelta
import pytest
from services import demand_forecast_service as dfs


def _pedidos_sinteticos(dias=60, base=5):
    """Genera `dias` días de pedidos sintéticos con un patrón claro:
    más pedidos los fines de semana, para poder verificar que el modelo
    aprende algo sensato."""
    pedidos = []
    inicio = datetime(2026, 1, 1)
    for i in range(dias):
        fecha = inicio + timedelta(days=i)
        es_finde = fecha.weekday() >= 5
        cantidad = base + (3 if es_finde else 0)
        for _ in range(cantidad):
            pedidos.append({
                'fecha': fecha.strftime('%d-%m-%Y'),
                'nombrelocal': 'Aguas Ancud',
                'precio': '4000',
                'usuario': f'cliente{i}@test.cl',
            })
    return pedidos


def test_construir_serie_diaria_cuenta_pedidos_por_dia():
    pedidos = _pedidos_sinteticos(dias=10, base=5)
    serie = dfs.construir_serie_diaria(pedidos)
    assert len(serie) == 10
    assert 'fecha' in serie.columns
    assert 'pedidos' in serie.columns
    assert serie['pedidos'].sum() > 0


def test_construir_serie_diaria_rellena_dias_sin_pedidos_con_cero():
    pedidos = [
        {'fecha': '01-01-2026', 'nombrelocal': 'Aguas Ancud', 'precio': '4000', 'usuario': 'a@test.cl'},
        {'fecha': '05-01-2026', 'nombrelocal': 'Aguas Ancud', 'precio': '4000', 'usuario': 'b@test.cl'},
    ]
    serie = dfs.construir_serie_diaria(pedidos)
    assert len(serie) == 5  # 01-ene a 05-ene inclusive
    assert serie['pedidos'].tolist() == [1, 0, 0, 0, 1]


def test_agregar_features_agrega_columnas_esperadas():
    pedidos = _pedidos_sinteticos(dias=30)
    serie = dfs.construir_serie_diaria(pedidos)
    features = dfs.agregar_features(serie)
    for col in dfs.FEATURES:
        assert col in features.columns
    assert features[dfs.FEATURES].isna().sum().sum() == 0


def test_predecir_proximos_dias_devuelve_rango_ordenado():
    pedidos = _pedidos_sinteticos(dias=60)
    predicciones = dfs.predecir_proximos_dias(pedidos, dias=7)
    assert len(predicciones) == 7
    for dia in predicciones:
        assert dia['p10'] <= dia['p50'] <= dia['p90']
        assert dia['p10'] >= 0


def test_predecir_proximos_dias_con_poco_historial_devuelve_vacio():
    pedidos = _pedidos_sinteticos(dias=5)
    predicciones = dfs.predecir_proximos_dias(pedidos, dias=7)
    assert predicciones == []
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd theycallmebitch/backend && python -m pytest test_demand_forecast_service.py -v`

Expected: `ModuleNotFoundError: No module named 'services.demand_forecast_service'`

- [ ] **Step 3: Implementar `demand_forecast_service.py`**

Crear `theycallmebitch/backend/services/demand_forecast_service.py`:

```python
"""
Servicio de pronóstico de demanda — XGBoost con regresión por cuantiles.

Predice pedidos esperados por día para los próximos N días, con un rango
(P10-P90) en vez de un solo número. El modelo se entrena en cada llamada
sobre los pedidos reales más recientes — no hay modelo serializado que
pueda desactualizarse.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

logger = logging.getLogger(__name__)

QUANTILES = {'p10': 0.1, 'p50': 0.5, 'p90': 0.9}
FEATURES = ['dow', 'dom', 'month', 'is_weekend', 'lag7', 'lag14', 'lag30', 'temp', 'trend_day']
MIN_DIAS_ENTRENAMIENTO = 14


def _parsear_fecha(fecha_str: Optional[str]):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def construir_serie_diaria(pedidos: List[Dict]) -> pd.DataFrame:
    """Convierte la lista cruda de pedidos en una serie de un renglón por
    día con el conteo de pedidos de ese día. Días sin pedidos quedan en 0."""
    df = pd.DataFrame(pedidos)
    if df.empty or 'fecha' not in df.columns:
        return pd.DataFrame(columns=['fecha', 'pedidos'])

    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])
    if df.empty:
        return pd.DataFrame(columns=['fecha', 'pedidos'])

    conteo = df.groupby(df['fecha_dt'].dt.date).size().rename('pedidos').reset_index()
    conteo = conteo.rename(columns={'fecha_dt': 'fecha'})

    rango = pd.date_range(conteo['fecha'].min(), conteo['fecha'].max(), freq='D')
    serie = pd.DataFrame({'fecha': rango.date})
    serie = serie.merge(conteo, on='fecha', how='left')
    serie['pedidos'] = serie['pedidos'].fillna(0).astype(int)
    return serie


def agregar_features(serie: pd.DataFrame, temperaturas_por_fecha: Dict = None) -> pd.DataFrame:
    """Agrega features de calendario, rezago y tendencia a la serie diaria.
    `temperaturas_por_fecha`: dict opcional {date: temp_c}; las fechas sin
    dato usan 15.0 (temperatura de referencia) para no romper el
    entrenamiento por falta de clima histórico."""
    serie = serie.copy().reset_index(drop=True)
    fechas = pd.to_datetime(serie['fecha'])
    serie['dow'] = fechas.dt.dayofweek
    serie['dom'] = fechas.dt.day
    serie['month'] = fechas.dt.month
    serie['is_weekend'] = (serie['dow'] >= 5).astype(int)
    serie['lag7'] = serie['pedidos'].rolling(7, min_periods=1).mean().shift(1)
    serie['lag14'] = serie['pedidos'].rolling(14, min_periods=1).mean().shift(1)
    serie['lag30'] = serie['pedidos'].rolling(30, min_periods=1).mean().shift(1)
    serie['trend_day'] = range(len(serie))

    temperaturas_por_fecha = temperaturas_por_fecha or {}
    serie['temp'] = serie['fecha'].map(lambda f: temperaturas_por_fecha.get(f, 15.0))

    serie[['lag7', 'lag14', 'lag30']] = serie[['lag7', 'lag14', 'lag30']].fillna(0)
    return serie


def _entrenar_modelo_cuantil(X: pd.DataFrame, y: pd.Series, alpha: float) -> XGBRegressor:
    modelo = XGBRegressor(
        objective='reg:quantileerror',
        quantile_alpha=alpha,
        n_estimators=150,
        max_depth=4,
        learning_rate=0.08,
        random_state=42,
    )
    modelo.fit(X, y)
    return modelo


def entrenar_modelos(serie_features: pd.DataFrame) -> Dict[str, XGBRegressor]:
    """Entrena un XGBRegressor por cuantil (P10/P50/P90)."""
    X = serie_features[FEATURES]
    y = serie_features['pedidos']
    return {nombre: _entrenar_modelo_cuantil(X, y, alpha) for nombre, alpha in QUANTILES.items()}


def predecir_proximos_dias(pedidos: List[Dict], dias: int = 7, temperaturas_futuras: Dict = None) -> List[Dict]:
    """Devuelve una lista de `dias` diccionarios {fecha, p10, p50, p90} con
    el pronóstico de pedidos por día. Lista vacía si no hay historial
    suficiente para entrenar un modelo razonable."""
    serie = construir_serie_diaria(pedidos)
    if len(serie) < MIN_DIAS_ENTRENAMIENTO:
        logger.warning(f"Historial insuficiente para pronóstico: {len(serie)} días (mínimo {MIN_DIAS_ENTRENAMIENTO})")
        return []

    serie_features = agregar_features(serie)
    modelos = entrenar_modelos(serie_features)

    temperaturas_futuras = temperaturas_futuras or {}
    serie_extendida = serie.copy()
    ultima_fecha = pd.to_datetime(serie['fecha'].iloc[-1])
    resultado = []

    for i in range(1, dias + 1):
        fecha_pred = (ultima_fecha + timedelta(days=i)).date()

        # Para calcular los lags del día a predecir se agrega momentáneamente
        # una fila con el promedio reciente como relleno.
        relleno = serie_extendida['pedidos'].tail(7).mean() if len(serie_extendida) else 0
        serie_para_features = pd.concat([
            serie_extendida,
            pd.DataFrame({'fecha': [fecha_pred], 'pedidos': [relleno]})
        ], ignore_index=True)

        features_dia = agregar_features(serie_para_features, temperaturas_futuras).iloc[[-1]]

        pred = {'fecha': str(fecha_pred)}
        for nombre, modelo in modelos.items():
            valor = float(modelo.predict(features_dia[FEATURES])[0])
            pred[nombre] = max(0.0, round(valor, 1))

        # Los tres modelos son independientes y pueden cruzarse levemente;
        # se fuerza el orden p10 <= p50 <= p90.
        p10, p50, p90 = sorted([pred['p10'], pred['p50'], pred['p90']])
        pred['p10'], pred['p50'], pred['p90'] = p10, p50, p90
        resultado.append(pred)

        # Encadenar la predicción: usar la mediana proyectada como "real"
        # para calcular los lags del día siguiente.
        serie_extendida = pd.concat([
            serie_extendida,
            pd.DataFrame({'fecha': [fecha_pred], 'pedidos': [pred['p50']]})
        ], ignore_index=True)

    return resultado
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd theycallmebitch/backend && python -m pytest test_demand_forecast_service.py -v`

Expected: 5 tests, todos `PASSED`.

- [ ] **Step 5: Commit**

```bash
cd theycallmebitch/backend
git add services/demand_forecast_service.py test_demand_forecast_service.py
git commit -m "feat: add XGBoost quantile demand forecasting service"
```

---

## Task 3: `demand_forecast_service.py` — validación de precisión (walk-forward)

**Files:**
- Modify: `theycallmebitch/backend/services/demand_forecast_service.py`
- Modify: `theycallmebitch/backend/test_demand_forecast_service.py`

**Interfaces:**
- Consumes: `construir_serie_diaria`, `agregar_features`, `FEATURES` de Task 2.
- Produces (usado por Task 5): `validar_precision(pedidos: List[Dict], dias_test: int = 30) -> Dict`
  — `{'mape_pct': float | None, 'dias_evaluados': int}`.

- [ ] **Step 1: Agregar el test (fallando)**

Agregar al final de `theycallmebitch/backend/test_demand_forecast_service.py`:

```python
def test_validar_precision_devuelve_mape_razonable():
    pedidos = _pedidos_sinteticos(dias=90)
    resultado = dfs.validar_precision(pedidos, dias_test=20)
    assert resultado['dias_evaluados'] > 0
    assert resultado['mape_pct'] is not None
    assert resultado['mape_pct'] >= 0


def test_validar_precision_con_poco_historial_devuelve_none():
    pedidos = _pedidos_sinteticos(dias=20)
    resultado = dfs.validar_precision(pedidos, dias_test=30)
    assert resultado == {'mape_pct': None, 'dias_evaluados': 0}
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `cd theycallmebitch/backend && python -m pytest test_demand_forecast_service.py::test_validar_precision_devuelve_mape_razonable -v`

Expected: `AttributeError: module 'services.demand_forecast_service' has no attribute 'validar_precision'`

- [ ] **Step 3: Implementar `validar_precision`**

Agregar al final de `theycallmebitch/backend/services/demand_forecast_service.py`:

```python
MIN_DIAS_VALIDACION = 45


def validar_precision(pedidos: List[Dict], dias_test: int = 30) -> Dict:
    """Walk-forward validation: para cada uno de los últimos `dias_test`
    días, entrena un modelo P50 solo con datos anteriores a ese día y
    predice ese día puntual, comparando contra lo que realmente pasó.
    Devuelve el error porcentual promedio real (MAPE), no inventado."""
    serie = construir_serie_diaria(pedidos)
    if len(serie) < MIN_DIAS_VALIDACION:
        return {'mape_pct': None, 'dias_evaluados': 0}

    errores = []
    inicio_test = max(MIN_DIAS_ENTRENAMIENTO, len(serie) - dias_test)

    for i in range(inicio_test, len(serie)):
        entrenamiento = serie.iloc[:i]
        if len(entrenamiento) < MIN_DIAS_ENTRENAMIENTO:
            continue

        real = serie['pedidos'].iloc[i]
        features_train = agregar_features(entrenamiento)
        modelo = _entrenar_modelo_cuantil(features_train[FEATURES], features_train['pedidos'], 0.5)

        fila_objetivo = pd.concat([entrenamiento, serie.iloc[[i]]], ignore_index=True)
        features_pred = agregar_features(fila_objetivo).iloc[[-1]]
        prediccion = max(0.0, float(modelo.predict(features_pred[FEATURES])[0]))

        base = max(real, 1)  # evita división por cero en días con 0 pedidos reales
        errores.append(abs(prediccion - real) / base)

    if not errores:
        return {'mape_pct': None, 'dias_evaluados': 0}

    mape = round(float(np.mean(errores)) * 100, 1)
    return {'mape_pct': mape, 'dias_evaluados': len(errores)}
```

- [ ] **Step 4: Correr todos los tests del archivo**

Run: `cd theycallmebitch/backend && python -m pytest test_demand_forecast_service.py -v`

Expected: 7 tests, todos `PASSED`.

- [ ] **Step 5: Commit**

```bash
cd theycallmebitch/backend
git add services/demand_forecast_service.py test_demand_forecast_service.py
git commit -m "feat: add walk-forward accuracy validation for demand forecast"
```

---

## Task 4: `customer_risk_service.py` — cadencia personal y riesgo priorizado

> **Nota sobre la spec:** el diseño original decía reutilizar
> `rfm_engine.py::calcular_rfm()` "tal cual". Al revisar esa función para
> este plan, se confirmó que su interfaz pública solo devuelve top-10 de
> clientes en riesgo y top-10 campeones — no expone la lista completa de
> clientes con su cadencia individual, que es justo lo que esta tarea
> necesita para calcular probabilidades empíricas sobre TODOS los
> clientes, no solo los 10 más críticos. Por eso `customer_risk_service.py`
> recalcula recencia/frecuencia/monetario/cadencia directamente desde los
> pedidos (una duplicación pequeña y justificada), pero seguIendo el mismo
> principio central de la spec: cadencia personal por cliente (no un
> umbral fijo) + probabilidad empírica (no una fórmula inventada) +
> priorización por valor en juego. `rfm_engine.py` no se modifica ni se
> elimina — sigue sirviendo al endpoint `/rfm` existente sin cambios.

**Files:**
- Create: `theycallmebitch/backend/services/customer_risk_service.py`
- Test: `theycallmebitch/backend/test_customer_risk_service.py`

**Interfaces:**
- Consumes: nada de otras tareas (autocontenido; no modifica `rfm_engine.py`).
- Produces (usado por Task 5):
  `calcular_riesgo_clientes(pedidos: List[Dict]) -> Dict` con forma:
  ```
  {
    'resumen': {'activos': int, 'en_riesgo': int, 'inactivos': int},
    'clientes': [
      {
        'usuario': str, 'telefono': str, 'direccion': str,
        'ultima_compra': str, 'dias_atraso': int,
        'cadencia_personal_dias': float | None,
        'gasto_promedio': float, 'probabilidad_reorden': float,
        'estado': 'activo' | 'en_riesgo' | 'inactivo',
        'valor_en_juego': float,
      }, ...
    ]  # ordenado por valor_en_juego descendente
  }
  ```

- [ ] **Step 1: Escribir los tests (fallando)**

Crear `theycallmebitch/backend/test_customer_risk_service.py`:

```python
"""Tests para customer_risk_service con datos sintéticos deterministas."""
from datetime import datetime, timedelta
import pytest
from services import customer_risk_service as crs


def _pedido(usuario, fecha_dt, precio=4000):
    return {
        'usuario': usuario,
        'fecha': fecha_dt.strftime('%d-%m-%Y'),
        'precio': str(precio),
        'nombrelocal': 'Aguas Ancud',
        'telefonou': '900000000',
        'dire': 'direccion de prueba',
    }


def _pedidos_cliente_regular(usuario, hoy, cada_dias, cantidad, ultima_hace_dias):
    """Genera pedidos de un cliente que compra cada `cada_dias` días,
    terminando `ultima_hace_dias` días atrás."""
    ultima_fecha = hoy - timedelta(days=ultima_hace_dias)
    pedidos = []
    for i in range(cantidad):
        fecha = ultima_fecha - timedelta(days=cada_dias * (cantidad - 1 - i))
        pedidos.append(_pedido(usuario, fecha))
    return pedidos


def test_cliente_al_dia_queda_activo():
    hoy = datetime.now()
    # Compra cada 10 días, su última compra fue hace 3 días -> al día
    pedidos = _pedidos_cliente_regular('activo@test.cl', hoy, cada_dias=10, cantidad=8, ultima_hace_dias=3)
    resultado = crs.calcular_riesgo_clientes(pedidos)
    cliente = next(c for c in resultado['clientes'] if c['usuario'] == 'activo@test.cl')
    assert cliente['estado'] == 'activo'
    assert cliente['dias_atraso'] == 0


def test_cliente_muy_atrasado_queda_inactivo():
    hoy = datetime.now()
    # Compra cada 10 días, pero lleva 90 días sin comprar -> inactivo
    pedidos = _pedidos_cliente_regular('inactivo@test.cl', hoy, cada_dias=10, cantidad=8, ultima_hace_dias=90)
    resultado = crs.calcular_riesgo_clientes(pedidos)
    cliente = next(c for c in resultado['clientes'] if c['usuario'] == 'inactivo@test.cl')
    assert cliente['estado'] == 'inactivo'
    assert cliente['dias_atraso'] > 0


def test_resumen_cuenta_todos_los_clientes():
    hoy = datetime.now()
    pedidos = (
        _pedidos_cliente_regular('a@test.cl', hoy, 10, 8, 3) +
        _pedidos_cliente_regular('b@test.cl', hoy, 10, 8, 90)
    )
    resultado = crs.calcular_riesgo_clientes(pedidos)
    total = resultado['resumen']['activos'] + resultado['resumen']['en_riesgo'] + resultado['resumen']['inactivos']
    assert total == 2


def test_lista_ordenada_por_valor_en_juego_descendente():
    hoy = datetime.now()
    pedidos = (
        _pedidos_cliente_regular('barato_atrasado@test.cl', hoy, 10, 8, 50, ) +
        [_pedido('barato_atrasado@test.cl', hoy - timedelta(days=d)) for d in []]
    )
    # Cliente caro y atrasado
    pedidos_caro = _pedidos_cliente_regular('caro_atrasado@test.cl', hoy, 10, 8, 50)
    pedidos_caro = [dict(p, precio='20000') for p in pedidos_caro]
    pedidos_barato = _pedidos_cliente_regular('barato_atrasado@test.cl', hoy, 10, 8, 50)
    pedidos_barato = [dict(p, precio='2000') for p in pedidos_barato]

    resultado = crs.calcular_riesgo_clientes(pedidos_caro + pedidos_barato)
    usuarios_en_orden = [c['usuario'] for c in resultado['clientes']]
    assert usuarios_en_orden.index('caro_atrasado@test.cl') < usuarios_en_orden.index('barato_atrasado@test.cl')


def test_cliente_con_un_solo_pedido_no_rompe():
    hoy = datetime.now()
    pedidos = [_pedido('unico@test.cl', hoy - timedelta(days=5))]
    resultado = crs.calcular_riesgo_clientes(pedidos)
    cliente = next(c for c in resultado['clientes'] if c['usuario'] == 'unico@test.cl')
    assert cliente['cadencia_personal_dias'] is None


def test_lista_vacia_no_rompe():
    resultado = crs.calcular_riesgo_clientes([])
    assert resultado == {'resumen': {'activos': 0, 'en_riesgo': 0, 'inactivos': 0}, 'clientes': []}
```

- [ ] **Step 2: Correr para verificar que fallan**

Run: `cd theycallmebitch/backend && python -m pytest test_customer_risk_service.py -v`

Expected: `ModuleNotFoundError: No module named 'services.customer_risk_service'`

- [ ] **Step 3: Implementar `customer_risk_service.py`**

Crear `theycallmebitch/backend/services/customer_risk_service.py`:

```python
"""
Servicio de riesgo de clientes.

Dos mejoras sobre un umbral fijo de "días sin comprar":
1. Cadencia personal: el intervalo típico de compra de CADA cliente
   (mediana de días entre sus propios pedidos), no un número igual para
   todos los clientes de un segmento.
2. Probabilidad empírica de reorden (capa "Markov"): frecuencia REAL,
   observada en el historial completo, de que un cliente que se atrasó
   tanto respecto a su propia cadencia haya vuelto a comprar dentro de la
   ventana de reorden — no una fórmula inventada.

La lista final se prioriza por cuánto se pierde si el cliente se va:
(1 - probabilidad_reorden) * gasto_promedio.
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

VENTANA_REORDEN_DIAS = 15
UMBRAL_INACTIVO_RATIO = 2.5  # veces la cadencia personal -> inactivo
PROBABILIDAD_RESPALDO_AL_DIA = 0.7
PROBABILIDAD_RESPALDO_ATRASADO = 0.3


def _parsear_fecha(fecha_str: Optional[str]):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def _preparar_dataframe(pedidos: List[Dict]) -> pd.DataFrame:
    df = pd.DataFrame(pedidos)
    if df.empty:
        return df
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if 'usuario' not in df.columns:
        return pd.DataFrame()
    df = df[df['usuario'].astype(str).str.strip() != '']
    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])
    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)
    return df


def _cadencia_por_cliente(df: pd.DataFrame) -> Dict[str, float]:
    """Mediana de días entre pedidos consecutivos, por cliente. Clientes
    con menos de 2 pedidos no tienen cadencia propia (no aparecen en el dict)."""
    cadencias = {}
    for usuario, grupo in df.groupby('usuario'):
        fechas = sorted(grupo['fecha_dt'].tolist())
        if len(fechas) < 2:
            continue
        intervalos = [(fechas[i] - fechas[i - 1]).days for i in range(1, len(fechas))]
        cadencias[usuario] = float(np.median(intervalos))
    return cadencias


def _bucket_de_atraso(dias_atraso: int, cadencia: float) -> str:
    if dias_atraso <= 0:
        return 'al_dia'
    ratio = dias_atraso / cadencia
    if ratio <= 0.5:
        return 'leve'
    if ratio <= 1.5:
        return 'moderado'
    return 'severo'


def _probabilidades_empiricas(df: pd.DataFrame, cadencias: Dict[str, float]) -> Dict[str, Optional[float]]:
    """Para cada uno de los pedidos PASADOS de cada cliente (excluyendo el
    último, que no tiene un "siguiente pedido" observable), calcula qué tan
    atrasado estaba respecto a su cadencia personal en ese momento, y si
    efectivamente volvió a comprar dentro de la ventana de reorden. Agrupa
    por bucket de atraso y devuelve la frecuencia real observada."""
    buckets = {'al_dia': [], 'leve': [], 'moderado': [], 'severo': []}

    for usuario, grupo in df.groupby('usuario'):
        cadencia = cadencias.get(usuario)
        if not cadencia or cadencia <= 0:
            continue
        fechas = sorted(grupo['fecha_dt'].tolist())
        for i in range(len(fechas) - 1):
            gap = (fechas[i + 1] - fechas[i]).days
            atraso_en_ese_momento = max(0, gap - round(cadencia))
            bucket = _bucket_de_atraso(atraso_en_ese_momento, cadencia)
            reordeno_a_tiempo = gap <= cadencia + VENTANA_REORDEN_DIAS
            buckets[bucket].append(reordeno_a_tiempo)

    return {
        bucket: (round(sum(obs) / len(obs), 2) if obs else None)
        for bucket, obs in buckets.items()
    }


def calcular_riesgo_clientes(pedidos: List[Dict]) -> Dict:
    """Punto de entrada principal."""
    vacio = {'resumen': {'activos': 0, 'en_riesgo': 0, 'inactivos': 0}, 'clientes': []}

    df = _preparar_dataframe(pedidos)
    if df.empty:
        return vacio

    cadencias = _cadencia_por_cliente(df)
    probabilidades_por_bucket = _probabilidades_empiricas(df, cadencias)

    hoy = datetime.now()
    resumen = {'activos': 0, 'en_riesgo': 0, 'inactivos': 0}
    clientes_resultado = []

    for usuario, grupo in df.groupby('usuario'):
        ultima_compra = max(grupo['fecha_dt'])
        recencia_dias = (hoy - ultima_compra).days
        gasto_promedio = float(grupo['precio_num'].mean())
        telefono = str(grupo.sort_values('fecha_dt', ascending=False)['telefonou'].iloc[0]) if 'telefonou' in grupo.columns else ''
        direccion = str(grupo.sort_values('fecha_dt', ascending=False)['dire'].iloc[0]) if 'dire' in grupo.columns else ''

        cadencia = cadencias.get(usuario)

        if cadencia and cadencia > 0:
            dias_atraso = max(0, recencia_dias - round(cadencia))
            bucket = _bucket_de_atraso(dias_atraso, cadencia)
            probabilidad = probabilidades_por_bucket.get(bucket)
            umbral_inactivo = cadencia * UMBRAL_INACTIVO_RATIO
        else:
            # Un solo pedido histórico: no hay cadencia propia que calcular.
            dias_atraso = 0
            probabilidad = None
            umbral_inactivo = 45  # respaldo genérico solo para este caso

        if probabilidad is None:
            probabilidad = PROBABILIDAD_RESPALDO_AL_DIA if dias_atraso <= 0 else PROBABILIDAD_RESPALDO_ATRASADO

        if dias_atraso <= 0:
            estado = 'activo'
        elif recencia_dias <= umbral_inactivo:
            estado = 'en_riesgo'
        else:
            estado = 'inactivo'

        resumen[estado] += 1
        valor_en_juego = round((1 - probabilidad) * gasto_promedio, 0)

        clientes_resultado.append({
            'usuario': usuario,
            'telefono': telefono,
            'direccion': direccion,
            'ultima_compra': ultima_compra.strftime('%d-%m-%Y'),
            'dias_atraso': int(dias_atraso),
            'cadencia_personal_dias': round(cadencia, 1) if cadencia else None,
            'gasto_promedio': round(gasto_promedio, 0),
            'probabilidad_reorden': probabilidad,
            'estado': estado,
            'valor_en_juego': valor_en_juego,
        })

    clientes_resultado.sort(key=lambda c: c['valor_en_juego'], reverse=True)

    return {'resumen': resumen, 'clientes': clientes_resultado}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd theycallmebitch/backend && python -m pytest test_customer_risk_service.py -v`

Expected: 6 tests, todos `PASSED`.

- [ ] **Step 5: Commit**

```bash
cd theycallmebitch/backend
git add services/customer_risk_service.py test_customer_risk_service.py
git commit -m "feat: add personalized-cadence customer risk service"
```

---

## Task 5: Endpoints nuevos en `main.py` + eliminar los viejos

**Files:**
- Modify: `theycallmebitch/backend/main.py`

**Interfaces:**
- Consumes: `demand_forecast_service.predecir_proximos_dias`,
  `demand_forecast_service.validar_precision`,
  `customer_risk_service.calcular_riesgo_clientes` (Tasks 2-4).
- Produces (usado por Task 7):
  - `GET /predictor/demanda` → `{manana: {p10,p50,p90}, dias_7: [...], proyeccion_mes: {actual, p10, p50, p90, meta}, precision_historica_pct, dias_evaluados}`
  - `GET /predictor/clientes-riesgo` → salida directa de `calcular_riesgo_clientes`.

- [ ] **Step 1: Ubicar y eliminar el código viejo del predictor**

Buscar en `theycallmebitch/backend/main.py`:

```bash
cd theycallmebitch/backend
grep -n "predictor-inteligente\|factores-prediccion\|validacion-predictor\|/tracking/\|def calcular_factores_dinamicos_avanzados\|def predecir_inteligente_avanzado\|def validacion_cruzada_predictor\|def analizar_clientes_vip\|def procesar_variables_exogenas" main.py
```

Eliminar (con un editor, borrando el bloque completo de cada función y cada
`@app.get`/`@app.post` encontrado por el grep anterior):
- Los endpoints `/predictor-inteligente`, `/factores-prediccion`,
  `/validacion-predictor`, y todos los `/tracking/*`.
- Las funciones `calcular_factores_dinamicos_avanzados`,
  `predecir_inteligente_avanzado`, `validacion_cruzada_predictor`,
  `analizar_clientes_vip`, `procesar_variables_exogenas`.

- [ ] **Step 2: Verificar que nada más los usa**

Run: `cd theycallmebitch/backend && grep -rn "predictor-inteligente\|factores-prediccion\|validacion-predictor\|calcular_factores_dinamicos_avanzados\|predecir_inteligente_avanzado\|validacion_cruzada_predictor\|analizar_clientes_vip\|procesar_variables_exogenas" main.py`

Expected: sin resultados (todo eliminado).

- [ ] **Step 3: Agregar los imports nuevos**

Ubicar la línea `from services import geocoding_service` en `main.py`
(agregada en el trabajo de Mapa de Calor) y agregar debajo:

```python
from services import demand_forecast_service
from services import customer_risk_service
```

- [ ] **Step 4: Agregar los endpoints nuevos**

Agregar al final de `main.py` (o en el lugar donde vivían los endpoints
eliminados en el Step 1):

```python
@app.get("/predictor/demanda", response_model=Dict)
def get_predictor_demanda():
    """Pronóstico de demanda: próximos 7 días con rango P10-P90 y
    proyección de fin de mes, más la precisión histórica real del modelo."""
    try:
        pedidos = data_adapter.obtener_pedidos_combinados()
    except Exception as e:
        logger.error(f"Error al obtener pedidos para predictor de demanda: {e}", exc_info=True)
        return {"dias_7": [], "manana": None, "proyeccion_mes": None, "precision_historica_pct": None}

    df = pd.DataFrame(pedidos)
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    pedidos_filtrados = df.to_dict('records')

    dias_7 = demand_forecast_service.predecir_proximos_dias(pedidos_filtrados, dias=7)
    validacion = demand_forecast_service.validar_precision(pedidos_filtrados, dias_test=30)

    if not dias_7:
        return {
            "dias_7": [], "manana": None, "proyeccion_mes": None,
            "precision_historica_pct": validacion['mape_pct'],
            "dias_evaluados": validacion['dias_evaluados'],
        }

    manana = dias_7[0]

    # Proyección de fin de mes: ventas reales ya ocurridas este mes +
    # la suma de las predicciones diarias para los días restantes.
    hoy = datetime.now().date()
    inicio_mes = hoy.replace(day=1)
    df['fecha_dt'] = df['fecha'].apply(lambda f: pd.to_datetime(f, format='%d-%m-%Y', errors='coerce'))
    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)
    ventas_mes_actual = float(df[df['fecha_dt'].dt.date >= inicio_mes]['precio_num'].sum())
    ticket_promedio = float(df['precio_num'].mean()) if len(df) else 2000.0

    dias_restantes_mes = [d for d in dias_7 if datetime.strptime(d['fecha'], '%Y-%m-%d').date().month == hoy.month]
    proyeccion_pedidos_p10 = sum(d['p10'] for d in dias_restantes_mes)
    proyeccion_pedidos_p50 = sum(d['p50'] for d in dias_restantes_mes)
    proyeccion_pedidos_p90 = sum(d['p90'] for d in dias_restantes_mes)

    meta = round(ventas_mes_actual * 1.1) if ventas_mes_actual > 0 else None

    return {
        "manana": manana,
        "dias_7": dias_7,
        "proyeccion_mes": {
            "actual": round(ventas_mes_actual),
            "p10": round(ventas_mes_actual + proyeccion_pedidos_p10 * ticket_promedio),
            "p50": round(ventas_mes_actual + proyeccion_pedidos_p50 * ticket_promedio),
            "p90": round(ventas_mes_actual + proyeccion_pedidos_p90 * ticket_promedio),
            "meta": meta,
        },
        "precision_historica_pct": validacion['mape_pct'],
        "dias_evaluados": validacion['dias_evaluados'],
    }


@app.get("/predictor/clientes-riesgo", response_model=Dict)
def get_predictor_clientes_riesgo():
    """Clientes en riesgo: cadencia personal por cliente, probabilidad
    empírica de reorden, priorizados por valor en juego."""
    try:
        pedidos = data_adapter.obtener_pedidos_combinados()
    except Exception as e:
        logger.error(f"Error al obtener pedidos para riesgo de clientes: {e}", exc_info=True)
        return {"resumen": {"activos": 0, "en_riesgo": 0, "inactivos": 0}, "clientes": []}

    df = pd.DataFrame(pedidos)
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']

    return customer_risk_service.calcular_riesgo_clientes(df.to_dict('records'))
```

- [ ] **Step 5: Reiniciar el backend limpio y probar**

```bash
cd theycallmebitch/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

En otra terminal, esperar ~15s a que cargue y correr:

Run: `curl -s http://127.0.0.1:8001/predictor/demanda | python -m json.tool`

Expected: JSON con `manana`, `dias_7` (7 elementos), `proyeccion_mes`,
`precision_historica_pct` — sin error 500.

Run: `curl -s http://127.0.0.1:8001/predictor/clientes-riesgo | python -m json.tool`

Expected: JSON con `resumen` (3 contadores) y `clientes` (lista ordenada
por `valor_en_juego` descendente) — sin error 500.

- [ ] **Step 6: Commit**

```bash
cd theycallmebitch/backend
git add main.py
git commit -m "feat: wire new demand/risk predictor endpoints, remove dead predictor code"
```

---

## Task 6: Eliminar los archivos muertos del predictor viejo

**Files:**
- Delete: `theycallmebitch/backend/predictor_simple.py`
- Delete: `theycallmebitch/backend/predictor_avanzado.py`
- Delete: `theycallmebitch/backend/predictor_ultra_simple.py`
- Delete: `theycallmebitch/backend/predictor_simple_efectivo.py`
- Delete: `theycallmebitch/backend/ml_predictor.py`
- Delete: `theycallmebitch/backend/mejoras_predictor.py`
- Delete: `theycallmebitch/backend/mejorar_predictor.py`
- Delete: `theycallmebitch/backend/entrenar_predictor.py`
- Delete: `theycallmebitch/backend/entrenar_predictor_final.py`
- Delete: `theycallmebitch/backend/entrenar_predictor_simple.py`
- Delete: `theycallmebitch/backend/entrenar_manual.py`
- Delete: `theycallmebitch/backend/predictor_simple_resultados.json`
- Delete: `theycallmebitch/backend/factores_entrenados.json`
- Delete: `theycallmebitch/backend/efectividad_predictor.json`
- Delete: `theycallmebitch/backend/predictor_tracking.json`
- Delete: `theycallmebitch/backend/predictor_mejorado.json`
- Delete: `theycallmebitch/backend/predictor_inteligente_resultados.json`
- Delete: `theycallmebitch/backend/predictor_ultra_simple_resultados.json`

**Interfaces:**
- Consumes: nada.
- Produces: nada (solo limpieza).

- [ ] **Step 1: Confirmar que ningún archivo vivo los importa**

```bash
cd theycallmebitch/backend
grep -rln "import predictor_simple\|import predictor_avanzado\|import predictor_ultra_simple\|import predictor_simple_efectivo\|import ml_predictor\|import mejoras_predictor\|import mejorar_predictor\|import entrenar_predictor\|import entrenar_manual" --include="*.py" . | grep -v "^\./predictor_\|^\./entrenar_\|^\./ml_predictor\|^\./mejora"
```

Expected: sin resultados. Si aparece algo, DETENERSE y revisar ese archivo
antes de continuar (no debería pasar — ya se verificó en el spec, pero es
la última comprobación antes de borrar).

- [ ] **Step 2: Borrar los archivos**

```bash
cd theycallmebitch/backend
rm -f predictor_simple.py predictor_avanzado.py predictor_ultra_simple.py \
      predictor_simple_efectivo.py ml_predictor.py mejoras_predictor.py \
      mejorar_predictor.py entrenar_predictor.py entrenar_predictor_final.py \
      entrenar_predictor_simple.py entrenar_manual.py \
      predictor_simple_resultados.json factores_entrenados.json \
      efectividad_predictor.json predictor_tracking.json \
      predictor_mejorado.json predictor_inteligente_resultados.json \
      predictor_ultra_simple_resultados.json
```

- [ ] **Step 3: Verificar que el backend sigue arrancando**

```bash
cd theycallmebitch/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Esperar ~15s, luego:

Run: `curl -s http://127.0.0.1:8001/predictor/demanda -o /dev/null -w "%{http_code}\n"`

Expected: `200`

- [ ] **Step 4: Commit**

```bash
cd theycallmebitch/backend
git add -A
git commit -m "chore: remove dead predictor scripts and frozen result artifacts"
```

---

## Task 7: `api.js` — reemplazar funciones del predictor viejo

**Files:**
- Modify: `theycallmebitch/frontend/src/services/api.js`

**Interfaces:**
- Consumes: endpoints `/predictor/demanda` y `/predictor/clientes-riesgo` (Task 5).
- Produces (usado por Tasks 8-9):
  - `getPredictorDemanda(): Promise<{manana, dias_7, proyeccion_mes, precision_historica_pct, dias_evaluados}>`
  - `getPredictorClientesRiesgo(): Promise<{resumen, clientes}>`

- [ ] **Step 1: Ubicar y eliminar las funciones viejas**

Run: `cd theycallmebitch/frontend/src/services && grep -n "getPredictorInteligente\|getFactoresPrediccion\|getValidacionPredictor\|getTrackingMetricas\|getTrackingReporte\|registrarPedidosReales\|getUltimasPredicciones" api.js`

Borrar cada una de esas funciones `export const ... = async (...) => { ... };`
completas de `api.js`.

- [ ] **Step 2: Agregar las funciones nuevas**

Agregar en el lugar donde vivían las funciones eliminadas:

```js
export const getPredictorDemanda = async () => {
  try {
    const response = await fetch(`${API_URL}/predictor/demanda`);
    if (!response.ok) {
      throw new Error('Error al obtener el pronóstico de demanda');
    }
    return await response.json();
  } catch (error) {
    console.error('Error obteniendo pronóstico de demanda:', error);
    return { manana: null, dias_7: [], proyeccion_mes: null, precision_historica_pct: null, dias_evaluados: 0 };
  }
};

export const getPredictorClientesRiesgo = async () => {
  try {
    const response = await fetch(`${API_URL}/predictor/clientes-riesgo`);
    if (!response.ok) {
      throw new Error('Error al obtener clientes en riesgo');
    }
    return await response.json();
  } catch (error) {
    console.error('Error obteniendo clientes en riesgo:', error);
    return { resumen: { activos: 0, en_riesgo: 0, inactivos: 0 }, clientes: [] };
  }
};
```

- [ ] **Step 3: Verificar que no queden referencias rotas**

Run: `cd theycallmebitch/frontend/src && grep -rn "getPredictorInteligente\|getFactoresPrediccion\|getValidacionPredictor\|getTrackingMetricas\|getTrackingReporte\|registrarPedidosReales\|getUltimasPredicciones" .`

Expected: sin resultados (se limpian en Task 10 los usos en `Predictor.jsx`
si este grep los encuentra ahí; si acaso, continuar de todas formas — Task
10 reescribe ese archivo completo).

- [ ] **Step 4: Commit**

```bash
cd theycallmebitch/frontend
git add src/services/api.js
git commit -m "feat: replace old predictor api functions with demand/risk endpoints"
```

---

## Task 8: `PredictorDemandaCard.jsx`

**Files:**
- Create: `theycallmebitch/frontend/src/components/PredictorDemandaCard.jsx`

**Interfaces:**
- Consumes: prop `data` con la forma exacta devuelta por
  `getPredictorDemanda()` (Task 7): `{manana, dias_7, proyeccion_mes, precision_historica_pct, dias_evaluados}`.
- Produces: componente `<PredictorDemandaCard data={...} />` (usado por Task 10).

- [ ] **Step 1: Crear el componente**

```jsx
import React from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { glassCardSx, GLASS_FONT_HEADING, GLASS_FONT_BODY } from '../utils/glassCard';

const CYAN = '#06b6d4';
const VIOLET = '#0d9488';

const formatoCLP = (val) => `$${Math.round(val || 0).toLocaleString('es-CL')}`;

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function CustomTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null;
  const p10 = payload.find(p => p.dataKey === 'p10')?.value;
  const p50 = payload.find(p => p.dataKey === 'p50')?.value;
  const p90 = payload.find(p => p.dataKey === 'p90')?.value;
  return (
    <Box sx={{
      px: 2, py: 1.5, borderRadius: '12px',
      background: isDark ? 'rgba(4,10,20,0.97)' : 'rgba(255,255,255,0.98)',
      border: isDark ? '1px solid rgba(6,182,212,0.22)' : '1px solid rgba(8,145,178,0.18)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: CYAN }}>{p50} pedidos (más probable)</Typography>
      <Typography sx={{ fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b' }}>Rango: {p10} - {p90}</Typography>
    </Box>
  );
}

export default function PredictorDemandaCard({ data }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const manana = data?.manana;
  const dias7 = data?.dias_7 || [];
  const proyeccion = data?.proyeccion_mes;
  const precision = data?.precision_historica_pct;

  const chartData = dias7.map(d => ({
    name: DIAS_SEMANA[new Date(d.fecha).getDay()],
    p10: d.p10,
    p50: d.p50,
    p90: d.p90,
  }));

  return (
    <Box sx={{ ...glassCardSx(theme, CYAN), padding: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{
          fontWeight: 700, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em',
          color: theme.palette.text.primary, fontFamily: GLASS_FONT_HEADING,
        }}>
          Demanda esperada
        </Typography>
        {precision != null && (
          <Box sx={{
            px: 1.25, py: 0.4, borderRadius: '8px',
            background: isDark ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.25)',
          }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669' }}>
              ±{precision}% de margen (últimos 30 días)
            </Typography>
          </Box>
        )}
      </Box>

      {!manana ? (
        <Typography sx={{ color: theme.palette.text.secondary, fontFamily: GLASS_FONT_BODY }}>
          No hay historial suficiente todavía para generar un pronóstico confiable.
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
            <Box sx={{ minWidth: 160 }}>
              <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Mañana
              </Typography>
              <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: theme.palette.text.primary, fontFamily: GLASS_FONT_HEADING, lineHeight: 1.1 }}>
                {manana.p10}-{manana.p90}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary }}>
                pedidos (~{manana.p50} más probable)
              </Typography>
            </Box>

            <Box sx={{ flex: 1, minWidth: 260, height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid stroke={isDark ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.045)'} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                  <Bar dataKey="p50" fill={CYAN} radius={[4, 4, 0, 0]} barSize={22} />
                  <Line dataKey="p90" stroke={VIOLET} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                  <Line dataKey="p10" stroke={VIOLET} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Box>

          {proyeccion && (
            <Box sx={{ pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Typography sx={{ fontSize: '0.85rem', color: theme.palette.text.primary, fontFamily: GLASS_FONT_BODY }}>
                Proyección fin de mes: <strong>{formatoCLP(proyeccion.p10)} - {formatoCLP(proyeccion.p90)}</strong>
                {proyeccion.meta && <> (meta: {formatoCLP(proyeccion.meta)})</>}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Verificar que no hay errores de sintaxis**

Run: `cd theycallmebitch/frontend && node --check src/components/PredictorDemandaCard.jsx 2>&1 || echo "revisar con el linter del editor (JSX no es JS puro, un error real aparecerá al levantar Vite en Task 10)"`

(Este chequeo es best-effort; la verificación real ocurre en el navegador
en Task 11.)

- [ ] **Step 3: Commit**

```bash
cd theycallmebitch/frontend
git add src/components/PredictorDemandaCard.jsx
git commit -m "feat: add PredictorDemandaCard component"
```

---

## Task 9: `PredictorClientesRiesgoCard.jsx`

**Files:**
- Create: `theycallmebitch/frontend/src/components/PredictorClientesRiesgoCard.jsx`

**Interfaces:**
- Consumes: prop `data` con la forma exacta devuelta por
  `getPredictorClientesRiesgo()` (Task 7): `{resumen, clientes}`.
- Produces: componente `<PredictorClientesRiesgoCard data={...} />` (usado por Task 10).

- [ ] **Step 1: Crear el componente**

```jsx
import React from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Chip } from '@mui/material';
import { glassCardSx, GLASS_FONT_HEADING, GLASS_FONT_BODY } from '../utils/glassCard';

const CYAN = '#06b6d4';

const ESTADO_INFO = {
  activo: { label: 'Activo', color: '#10b981' },
  en_riesgo: { label: 'En riesgo', color: '#f59e0b' },
  inactivo: { label: 'Inactivo', color: '#ef4444' },
};

const formatoCLP = (val) => `$${Math.round(val || 0).toLocaleString('es-CL')}`;

function ResumenChip({ label, value, color }) {
  return (
    <Box sx={{
      flex: '1 1 100px', textAlign: 'center', padding: '10px 8px',
      borderRadius: '12px', background: `${color}14`, border: `1px solid ${color}33`,
    }}>
      <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color, fontFamily: GLASS_FONT_HEADING }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: '0.7rem', color: color, fontWeight: 600 }}>{label}</Typography>
    </Box>
  );
}

export default function PredictorClientesRiesgoCard({ data }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const resumen = data?.resumen || { activos: 0, en_riesgo: 0, inactivos: 0 };
  const clientes = data?.clientes || [];

  // Prioridad visual: los primeros 20 por valor en juego (la lista ya
  // viene ordenada desde el backend).
  const clientesTop = clientes.slice(0, 20);

  return (
    <Box sx={{ ...glassCardSx(theme, CYAN), padding: 3 }}>
      <Typography sx={{
        fontWeight: 700, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em',
        color: theme.palette.text.primary, fontFamily: GLASS_FONT_HEADING, mb: 2,
      }}>
        Clientes en riesgo
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <ResumenChip label="Activos" value={resumen.activos} color={ESTADO_INFO.activo.color} />
        <ResumenChip label="En riesgo" value={resumen.en_riesgo} color={ESTADO_INFO.en_riesgo.color} />
        <ResumenChip label="Inactivos" value={resumen.inactivos} color={ESTADO_INFO.inactivo.color} />
      </Box>

      {clientesTop.length === 0 ? (
        <Typography sx={{ color: theme.palette.text.secondary, fontFamily: GLASS_FONT_BODY }}>
          No hay datos de clientes todavía.
        </Typography>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <Box component="thead">
              <Box component="tr">
                {['Cliente', 'Última compra', 'Atraso', 'Gasto prom.', 'Estado'].map(h => (
                  <Box component="th" key={h} sx={{
                    textAlign: 'left', fontSize: '0.7rem', fontWeight: 700,
                    color: theme.palette.text.secondary, textTransform: 'uppercase',
                    letterSpacing: '0.04em', padding: '8px 10px',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  }}>
                    {h}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {clientesTop.map((c) => {
                const estado = ESTADO_INFO[c.estado] || ESTADO_INFO.activo;
                return (
                  <Box component="tr" key={c.usuario} sx={{
                    '&:hover': { background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                  }}>
                    <Box component="td" sx={{ padding: '8px 10px', fontSize: '0.82rem', color: theme.palette.text.primary, fontFamily: GLASS_FONT_BODY }}>
                      {c.usuario}
                    </Box>
                    <Box component="td" sx={{ padding: '8px 10px', fontSize: '0.82rem', color: theme.palette.text.secondary }}>
                      {c.ultima_compra}
                    </Box>
                    <Box component="td" sx={{ padding: '8px 10px', fontSize: '0.82rem', color: theme.palette.text.secondary }}>
                      {c.dias_atraso > 0 ? `+${c.dias_atraso}d` : 'al día'}
                    </Box>
                    <Box component="td" sx={{ padding: '8px 10px', fontSize: '0.82rem', color: theme.palette.text.primary, fontWeight: 600 }}>
                      {formatoCLP(c.gasto_promedio)}
                    </Box>
                    <Box component="td" sx={{ padding: '8px 10px' }}>
                      <Chip
                        label={estado.label}
                        size="small"
                        sx={{
                          background: `${estado.color}1a`, color: estado.color,
                          border: `1px solid ${estado.color}40`, fontWeight: 600, fontSize: '0.7rem',
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd theycallmebitch/frontend
git add src/components/PredictorClientesRiesgoCard.jsx
git commit -m "feat: add PredictorClientesRiesgoCard component"
```

---

## Task 10: Reescribir `Predictor.jsx`

**Files:**
- Modify: `theycallmebitch/frontend/src/pages/Predictor.jsx` (reescritura completa)

**Interfaces:**
- Consumes: `getPredictorDemanda`, `getPredictorClientesRiesgo` (Task 7);
  `PredictorDemandaCard`, `PredictorClientesRiesgoCard` (Tasks 8-9).
- Produces: página `/predictor` funcional, sin formulario manual.

- [ ] **Step 1: Reescribir el archivo completo**

Reemplazar TODO el contenido de `theycallmebitch/frontend/src/pages/Predictor.jsx` por:

```jsx
import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, CircularProgress } from '@mui/material';
import PredictorDemandaCard from '../components/PredictorDemandaCard';
import PredictorClientesRiesgoCard from '../components/PredictorClientesRiesgoCard';
import { getPredictorDemanda, getPredictorClientesRiesgo } from '../services/api';

export default function Predictor() {
  const theme = useTheme();
  const [demanda, setDemanda] = useState(null);
  const [riesgo, setRiesgo] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarDatos = async () => {
    try {
      const [demandaData, riesgoData] = await Promise.all([
        getPredictorDemanda(),
        getPredictorClientesRiesgo(),
      ]);
      setDemanda(demandaData);
      setRiesgo(riesgoData);
    } catch (error) {
      console.error('Error cargando datos del predictor:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    const interval = setInterval(cargarDatos, 10 * 60 * 1000);
    const handleGlobalRefresh = () => cargarDatos();
    window.addEventListener('globalRefresh', handleGlobalRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('globalRefresh', handleGlobalRefresh);
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 1.5 }}>
        <CircularProgress size={22} thickness={4} sx={{ color: '#06b6d4' }} />
        <Typography sx={{ color: theme.palette.text.secondary }}>Cargando predictor…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '100vh' }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Box sx={{ mb: 3 }}>
          <Typography sx={{
            fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.85rem' },
            color: theme.palette.text.primary, letterSpacing: '-0.02em',
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          }}>
            Predictor
          </Typography>
          <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.9rem', mt: 0.3 }}>
            Qué esperar los próximos días, y a quién no perder
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <PredictorDemandaCard data={demanda} />
          <PredictorClientesRiesgoCard data={riesgo} />
        </Box>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd theycallmebitch/frontend
git add src/pages/Predictor.jsx
git commit -m "feat: rebuild Predictor page as single-page demand + risk view"
```

---

## Task 11: Eliminar `PrediccionCumplimientoCard.jsx` y verificar referencias

**Files:**
- Delete: `theycallmebitch/frontend/src/components/PrediccionCumplimientoCard.jsx`

**Interfaces:**
- Consumes: nada.
- Produces: nada (limpieza).

- [ ] **Step 1: Confirmar que nada lo importa**

Run: `cd theycallmebitch/frontend/src && grep -rn "PrediccionCumplimientoCard" .`

Expected: sin resultados (Task 10 ya reescribió `Predictor.jsx` sin ese import).

- [ ] **Step 2: Borrar el archivo**

```bash
rm "theycallmebitch/frontend/src/components/PrediccionCumplimientoCard.jsx"
```

- [ ] **Step 3: Commit**

```bash
cd theycallmebitch/frontend
git add -A
git commit -m "chore: remove unused PrediccionCumplimientoCard component"
```

---

## Task 12: Verificación end-to-end en navegador

**Files:** ninguno (solo verificación manual).

**Interfaces:** ninguna nueva.

- [ ] **Step 1: Levantar backend y frontend**

Backend:
```bash
cd theycallmebitch/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

Frontend (otra terminal):
```bash
cd theycallmebitch/frontend
npm run dev
```

- [ ] **Step 2: Abrir `/predictor` en el navegador y verificar**

- La página carga automáticamente, sin ningún formulario que llenar antes de ver datos.
- La tarjeta "Demanda esperada" muestra un número de "Mañana" con rango, un gráfico de 7 días, y una proyección de fin de mes.
- El badge "±X% de margen" aparece junto al título (o la tarjeta indica claramente que no hay historial suficiente, si aplica).
- La tarjeta "Clientes en riesgo" muestra los 3 contadores (Activos/En riesgo/Inactivos) sumando el total de clientes, y una tabla ordenada — verificar que el primer cliente de la tabla tiene, a ojo, un `gasto_promedio` alto Y un `estado` de riesgo (no un cliente activo barato primero).
- No hay errores en la consola del navegador (F12 → Console).

- [ ] **Step 3: Confirmar que no quedó nada del módulo viejo**

Run: `cd theycallmebitch/frontend/src && grep -rn "Predictor Clásico\|calcularForecastCompleto\|tipoCliente" .`

Expected: sin resultados.

- [ ] **Step 4: Commit final si hubo ajustes**

Si el Step 2 reveló algún ajuste visual necesario, hacerlo y:

```bash
cd theycallmebitch/frontend
git add -A
git commit -m "fix: polish Predictor page after end-to-end verification"
```
