# Rediseño del módulo Clientes — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la reconstrucción ingenua de "clientes" (derivados del primer pedido por email, con un umbral fijo de 75 días recalculado 5 veces en el frontend) por una agregación correcta en el backend que reutiliza `customer_risk_service` (estado) y `rfm_engine` extendido (tipo VIP), y reducir `Clientes.jsx` eliminando toda la lógica duplicada y la UI muerta.

**Architecture:** Nuevo servicio `customer_profile_service.py` agrega pedidos por cliente usando el pedido más reciente para contacto. `/clientes` combina ese perfil con `estado` de `customer_risk_service.calcular_riesgo_clientes()` y `tipo` de una extensión aditiva a `rfm_engine.calcular_rfm()`. El frontend deja de recalcular nada de esto y consume los campos ya resueltos.

**Tech Stack:** FastAPI, pandas, React + MUI (mismos que el resto del proyecto).

## Global Constraints

- No modificar el comportamiento actual de `services/customer_risk_service.py` (ya probado y en producción para `/predictor/clientes-riesgo`) — solo se **llama**, no se edita.
- La extensión a `rfm_engine.py` debe ser **aditiva**: `/rfm` debe devolver exactamente los mismos campos que hoy, más el nuevo `segmento_por_cliente`. No romper su firma ni sus consumidores existentes.
- Ambos motores agrupan por `usuario` (email/pseudo-email) — mantener esa misma clave de agrupación en `customer_profile_service.py` para que los tres (`customer_profile_service`, `customer_risk_service`, `rfm_engine`) hablen de "el mismo cliente" de forma consistente. No introducir una clave de agrupación distinta (ej. por dirección) en este trabajo.
- El diseño visual de `Clientes.jsx` (cards, tablas, colores, layout) **no cambia** — solo se elimina lo roto/muerto y se simplifica de dónde vienen los datos. No es un rediseño de UX/UI.
- Todo pedido se filtra a `nombrelocal == 'aguas ancud'` (mismo criterio que el resto del sistema) — ya lo hacen `customer_risk_service` y `rfm_engine`; `customer_profile_service` debe hacerlo también.
- `/clientes` sigue siendo `GET`, sin parámetros de entrada, mismo patrón que `/predictor/demanda` y `/predictor/clientes-riesgo`.

---

### Task 1: Extender `rfm_engine.py` con segmento por cliente (aditivo)

**Files:**
- Modify: `theycallmebitch/backend/services/rfm_engine.py`
- Test: `theycallmebitch/backend/test_rfm_engine.py` (nuevo — no existe test para este archivo hoy)

**Interfaces:**
- Consumes: nada nuevo, usa el DataFrame `rfm` que la función ya construye internamente (columnas `usuario`, `segmento`).
- Produces: `calcular_rfm(pedidos)` devuelve el mismo dict de siempre más una clave nueva `segmento_por_cliente: Dict[str, str]` — mapea cada `usuario` evaluado a su string de segmento (`'campeon'`, `'leal'`, etc., las mismas claves de `SEGMENTOS`). Task 3 lo consume así: `rfm_data['segmento_por_cliente'].get(usuario)`.

- [ ] **Step 1: Escribir el test que falla**

Crear `theycallmebitch/backend/test_rfm_engine.py`:

```python
from datetime import datetime, timedelta

from services.rfm_engine import calcular_rfm


def _pedido(usuario, dias_atras, precio=2000, nombrelocal='Aguas Ancud'):
    fecha = (datetime.now() - timedelta(days=dias_atras)).strftime('%d-%m-%Y')
    return {'usuario': usuario, 'fecha': fecha, 'precio': str(precio), 'nombrelocal': nombrelocal}


def test_segmento_por_cliente_cubre_a_todos_no_solo_el_top_10():
    pedidos = []
    # 15 clientes distintos, cada uno con varios pedidos recientes -> ninguno debería quedar fuera del mapa.
    for i in range(15):
        usuario = f'cliente{i}@fluvi.cl'
        for dias in (5, 20, 35):
            pedidos.append(_pedido(usuario, dias))

    resultado = calcular_rfm(pedidos)

    assert 'segmento_por_cliente' in resultado
    assert len(resultado['segmento_por_cliente']) == 15
    for i in range(15):
        usuario = f'cliente{i}@fluvi.cl'
        assert usuario in resultado['segmento_por_cliente']
        assert resultado['segmento_por_cliente'][usuario] in {
            'campeon', 'leal', 'potencial_leal', 'nuevo',
            'prometedor', 'necesita_atencion', 'en_riesgo', 'perdido',
        }


def test_segmento_por_cliente_vacio_si_no_hay_pedidos():
    resultado = calcular_rfm([])
    assert resultado['segmento_por_cliente'] == {}


def test_rfm_sigue_devolviendo_los_mismos_campos_de_siempre():
    pedidos = [_pedido('a@fluvi.cl', 5), _pedido('a@fluvi.cl', 20)]
    resultado = calcular_rfm(pedidos)
    for campo in (
        'total_clientes', 'clientes_en_riesgo_count', 'revenue_en_riesgo',
        'clientes_perdidos_count', 'revenue_perdido_historico',
        'ticket_promedio_global', 'resumen_segmentos', 'clientes_en_riesgo',
        'clientes_campeon',
    ):
        assert campo in resultado
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd theycallmebitch/backend && python -m pytest test_rfm_engine.py -v`
Expected: FAIL — `KeyError: 'segmento_por_cliente'` (el campo no existe todavía).

- [ ] **Step 3: Agregar `segmento_por_cliente` a `calcular_rfm`**

En `theycallmebitch/backend/services/rfm_engine.py`, dentro de `calcular_rfm`, justo antes del `return` final (después de que ya existe `rfm['segmento']`, alrededor de la línea donde se arma `resumen_segmentos`), agregar:

```python
        segmento_por_cliente = dict(zip(rfm['usuario'], rfm['segmento']))
```

Y agregar la clave al dict de retorno:

```python
        return {
            'total_clientes': total_clientes,
            'clientes_en_riesgo_count': total_en_riesgo,
            'revenue_en_riesgo': revenue_en_riesgo,
            'clientes_perdidos_count': clientes_perdidos,
            'revenue_perdido_historico': revenue_perdido,
            'ticket_promedio_global': ticket_promedio_global,
            'resumen_segmentos': resumen_segmentos,
            'clientes_en_riesgo': clientes_en_riesgo,
            'clientes_campeon': clientes_campeon,
            'segmento_por_cliente': segmento_por_cliente,
        }
```

Y en `_respuesta_vacia()`, agregar la misma clave vacía:

```python
def _respuesta_vacia() -> Dict:
    return {
        'total_clientes': 0,
        'clientes_en_riesgo_count': 0,
        'revenue_en_riesgo': 0,
        'clientes_perdidos_count': 0,
        'revenue_perdido_historico': 0,
        'ticket_promedio_global': 0,
        'resumen_segmentos': [],
        'clientes_en_riesgo': [],
        'clientes_campeon': [],
        'segmento_por_cliente': {},
    }
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd theycallmebitch/backend && python -m pytest test_rfm_engine.py -v`
Expected: PASS (3/3 tests).

- [ ] **Step 5: Commit**

```bash
git add theycallmebitch/backend/services/rfm_engine.py theycallmebitch/backend/test_rfm_engine.py
git commit -m "feat: expose per-client RFM segment, not just top-10 lists"
```

---

### Task 2: Crear `customer_profile_service.py` (agregación real por cliente)

**Files:**
- Create: `theycallmebitch/backend/services/customer_profile_service.py`
- Test: `theycallmebitch/backend/test_customer_profile_service.py`

**Interfaces:**
- Consumes: lista de pedidos ya combinados (mismo formato que recibe `customer_risk_service.calcular_riesgo_clientes` y `rfm_engine.calcular_rfm` — dicts con `usuario`, `fecha`, `precio`, `dire`, `telefonou`, `nombrelocal`).
- Produces: `construir_perfiles_clientes(pedidos) -> List[Dict]`, una fila por cliente único (agrupado por `usuario`), cada una con: `usuario`, `direccion`, `telefono`, `pedidos` (int, conteo real), `total_comprado` (float, suma real), `ultimo_pedido` (str `DD-MM-YYYY`), `primera_compra` (str `DD-MM-YYYY`). Task 3 la combina con `customer_risk_service` (estado) y `rfm_engine` (tipo) por `usuario`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `theycallmebitch/backend/test_customer_profile_service.py`:

```python
from services.customer_profile_service import construir_perfiles_clientes


def _pedido(usuario, fecha, precio=2000, dire='calle 1', telefonou='912345678', nombrelocal='Aguas Ancud'):
    return {
        'usuario': usuario, 'fecha': fecha, 'precio': str(precio),
        'dire': dire, 'telefonou': telefonou, 'nombrelocal': nombrelocal,
    }


def test_usa_el_pedido_mas_reciente_para_contacto_no_el_primero():
    pedidos = [
        _pedido('ana@fluvi.cl', '01-01-2025', dire='direccion vieja', telefonou='111'),
        _pedido('ana@fluvi.cl', '15-06-2026', dire='direccion nueva', telefonou='222'),
    ]
    perfiles = construir_perfiles_clientes(pedidos)
    assert len(perfiles) == 1
    assert perfiles[0]['direccion'] == 'direccion nueva'
    assert perfiles[0]['telefono'] == '222'


def test_pedidos_count_y_total_comprado_son_sumas_reales():
    pedidos = [
        _pedido('ana@fluvi.cl', '01-01-2025', precio=2000),
        _pedido('ana@fluvi.cl', '10-01-2025', precio=3000),
        _pedido('ana@fluvi.cl', '20-01-2025', precio=2500),
    ]
    perfiles = construir_perfiles_clientes(pedidos)
    assert perfiles[0]['pedidos'] == 3
    assert perfiles[0]['total_comprado'] == 7500


def test_primera_compra_y_ultimo_pedido_correctos():
    pedidos = [
        _pedido('ana@fluvi.cl', '01-01-2025'),
        _pedido('ana@fluvi.cl', '20-06-2026'),
        _pedido('ana@fluvi.cl', '15-03-2025'),
    ]
    perfiles = construir_perfiles_clientes(pedidos)
    assert perfiles[0]['primera_compra'] == '01-01-2025'
    assert perfiles[0]['ultimo_pedido'] == '20-06-2026'


def test_filtra_a_aguas_ancud_solamente():
    pedidos = [
        _pedido('ana@fluvi.cl', '01-01-2025', nombrelocal='Aguas Ancud'),
        _pedido('otro@fluvi.cl', '01-01-2025', nombrelocal='Otra Marca'),
    ]
    perfiles = construir_perfiles_clientes(pedidos)
    assert len(perfiles) == 1
    assert perfiles[0]['usuario'] == 'ana@fluvi.cl'


def test_lista_vacia_no_rompe():
    assert construir_perfiles_clientes([]) == []


def test_pedido_sin_usuario_se_ignora():
    pedidos = [_pedido('', '01-01-2025'), _pedido('ana@fluvi.cl', '01-01-2025')]
    perfiles = construir_perfiles_clientes(pedidos)
    assert len(perfiles) == 1
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd theycallmebitch/backend && python -m pytest test_customer_profile_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'services.customer_profile_service'`.

- [ ] **Step 3: Implementar el servicio**

Crear `theycallmebitch/backend/services/customer_profile_service.py`:

```python
"""
Servicio de perfil de cliente.

No existe una base de clientes real (el endpoint legacy que la alimentaba
está muerto — ver docs/superpowers/specs/2026-07-18-clientes-redesign-design.md).
Este módulo agrega TODOS los pedidos de cada cliente y usa el pedido MÁS
RECIENTE para los datos de contacto (dirección/teléfono), en vez de
congelar el primer pedido que se haya visto — así si un cliente se mudó o
cambió de número, el perfil lo refleja.
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)


def _parsear_fecha(fecha_str: Optional[str]):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def construir_perfiles_clientes(pedidos: List[Dict]) -> List[Dict]:
    """Devuelve una fila por cliente único (agrupado por `usuario`), con
    contacto tomado del pedido más reciente y totales reales agregados."""
    df = pd.DataFrame(pedidos)
    if df.empty:
        return []

    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if 'usuario' not in df.columns:
        return []
    df = df[df['usuario'].astype(str).str.strip() != '']
    if df.empty:
        return []

    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])
    if df.empty:
        return []
    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)

    perfiles = []
    for usuario, grupo in df.groupby('usuario'):
        grupo_ordenado = grupo.sort_values('fecha_dt', ascending=False)
        mas_reciente = grupo_ordenado.iloc[0]
        primera_compra = grupo['fecha_dt'].min()
        ultimo_pedido = grupo['fecha_dt'].max()

        perfiles.append({
            'usuario': usuario,
            'direccion': str(mas_reciente.get('dire', '') or ''),
            'telefono': str(mas_reciente.get('telefonou', '') or ''),
            'pedidos': int(len(grupo)),
            'total_comprado': float(grupo['precio_num'].sum()),
            'ultimo_pedido': ultimo_pedido.strftime('%d-%m-%Y'),
            'primera_compra': primera_compra.strftime('%d-%m-%Y'),
        })

    return perfiles
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd theycallmebitch/backend && python -m pytest test_customer_profile_service.py -v`
Expected: PASS (7/7 tests).

- [ ] **Step 5: Commit**

```bash
git add theycallmebitch/backend/services/customer_profile_service.py theycallmebitch/backend/test_customer_profile_service.py
git commit -m "feat: add customer_profile_service, aggregates by most-recent order not first"
```

---

### Task 3: Reescribir `/clientes`, eliminar el fallback muerto y la llamada al endpoint legacy

**Files:**
- Modify: `theycallmebitch/backend/main.py`
- Modify: `theycallmebitch/backend/data_adapter.py`
- Delete: `theycallmebitch/backend/test_cliente_estado.py` (script de debug ad-hoc, no es un test real — pega directo al endpoint legacy muerto `fluvi.cl/.../pedidos.php`, sin asserts, y es lo que originó el hack de "Walker Martinez" que se elimina en Task 5)

**Interfaces:**
- Consumes: `customer_profile_service.construir_perfiles_clientes` (Task 2), `customer_risk_service.calcular_riesgo_clientes` (ya existe), `rfm_engine.calcular_rfm` (Task 1, usa `segmento_por_cliente`).
- Produces: `GET /clientes` devuelve `List[Dict]`, cada dict con las claves: `usuario`, `direccion`, `telefono`, `pedidos`, `total_comprado`, `ultimo_pedido`, `primera_compra`, `estado` (`'activo'|'en_riesgo'|'inactivo'`), `tipo` (`'VIP'|'Regular'`), `dias_atraso`, `cadencia_personal_dias`. Task 5 (frontend) consume esta forma directamente — son los nombres de campo exactos que debe leer.

- [ ] **Step 1: Borrar la llamada muerta al endpoint legacy en `data_adapter.py`**

En `theycallmebitch/backend/data_adapter.py`, eliminar por completo el método `fetch_clientes_antiguos` (busca `def fetch_clientes_antiguos`) — ya no se llama desde ningún lado después de este task. También eliminar la constante `ENDPOINT_CLIENTES_ANTIGUO` (busca `ENDPOINT_CLIENTES_ANTIGUO =`) si no queda ninguna otra referencia a ella tras borrar el método (verificar con `grep -n ENDPOINT_CLIENTES_ANTIGUO theycallmebitch/backend/data_adapter.py` — debe no dar resultados al terminar).

También eliminar `obtener_clientes_combinados` y `combinar_clientes` (ya no se necesitan — Task 3 Step 2 reemplaza su única llamada en `main.py`). Verificar con `grep -rn "obtener_clientes_combinados\|combinar_clientes\|clientes_antiguos_cache" theycallmebitch/backend/` que no quede ninguna referencia fuera de este archivo antes de borrar (ya se confirmó antes de escribir este plan que solo `main.py` y `data_adapter.py` los usan).

En el `__init__` de `DataAdapter`, eliminar la línea `self.clientes_antiguos_cache = None` (ya no se usa).

- [ ] **Step 2: Reescribir el endpoint `/clientes` en `main.py`**

Agregar el import al inicio de `theycallmebitch/backend/main.py`, junto a los demás imports de `services` (cerca de la línea 41):

```python
from services import customer_profile_service
```

Buscar el bloque completo del endpoint actual (`@app.get("/clientes"...` hasta el final de `extraer_clientes_de_pedidos`, aproximadamente `main.py:376` a `main.py:454`) y reemplazarlo entero por:

```python
@app.get("/clientes", response_model=List[Dict])
def get_clientes():
    """Perfil agregado de clientes: se agrupan todos los pedidos por
    usuario (no hay una base de clientes real — ver
    docs/superpowers/specs/2026-07-18-clientes-redesign-design.md), usando
    el pedido más reciente para contacto. Estado viene de la misma
    cadencia personal que usa el Predictor; tipo (VIP/Regular) viene del
    segmento RFM."""
    try:
        pedidos = data_adapter.obtener_pedidos_combinados()
    except Exception as e:
        logger.error(f"Error al obtener pedidos para /clientes: {e}", exc_info=True)
        return []

    df = pd.DataFrame(pedidos)
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    pedidos_filtrados = df.to_dict('records')

    perfiles = customer_profile_service.construir_perfiles_clientes(pedidos_filtrados)
    if not perfiles:
        return []

    riesgo = customer_risk_service.calcular_riesgo_clientes(pedidos_filtrados)
    estado_por_usuario = {c['usuario']: c for c in riesgo['clientes']}

    try:
        rfm_data = calcular_rfm(pedidos_filtrados)
        segmento_por_usuario = rfm_data.get('segmento_por_cliente', {})
    except Exception as e:
        logger.error(f"Error calculando RFM para /clientes: {e}", exc_info=True)
        segmento_por_usuario = {}

    segmentos_vip = {'campeon', 'leal'}

    resultado = []
    for perfil in perfiles:
        usuario = perfil['usuario']
        riesgo_cliente = estado_por_usuario.get(usuario)
        segmento = segmento_por_usuario.get(usuario)

        resultado.append({
            **perfil,
            'estado': riesgo_cliente['estado'] if riesgo_cliente else 'activo',
            'dias_atraso': riesgo_cliente['dias_atraso'] if riesgo_cliente else 0,
            'cadencia_personal_dias': riesgo_cliente['cadencia_personal_dias'] if riesgo_cliente else None,
            'tipo': 'VIP' if segmento in segmentos_vip else 'Regular',
        })

    resultado.sort(key=lambda c: c['total_comprado'], reverse=True)
    return resultado
```

Nota: `riesgo_cliente['estado'] if riesgo_cliente else 'activo'` es el único fallback razonable — si `customer_risk_service` no devolvió fila para ese usuario (no debería pasar, agrupa por la misma clave, pero se cubre por robustez) se asume activo en vez de romper la respuesta completa.

- [ ] **Step 3: Borrar el script de debug**

```bash
rm theycallmebitch/backend/test_cliente_estado.py
```

- [ ] **Step 4: Verificar en vivo**

Levantar el backend y probar el endpoint:

```bash
cd theycallmebitch/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8001 &
sleep 8
curl -s http://localhost:8001/clientes | python -m json.tool | head -30
```

Expected: JSON con clientes reales, cada uno con `estado`, `tipo`, `pedidos`, `total_comprado`, `ultimo_pedido`, `primera_compra` — sin `localoficial`, sin `clave`, sin `verificar`. Confirmar que `curl -s http://localhost:8001/rfm | python -m json.tool | head -5` sigue respondiendo sin errores (no se rompió `/rfm`).

- [ ] **Step 5: Commit**

```bash
git add theycallmebitch/backend/main.py theycallmebitch/backend/data_adapter.py
git rm theycallmebitch/backend/test_cliente_estado.py
git commit -m "feat: rewrite /clientes to aggregate real orders instead of legacy fallback

Reuses customer_risk_service (estado) and the RFM segment extension
(tipo) instead of the dead legacy endpoint + first-order-wins fallback.
Removes the always-404 network call to the legacy clientes.php endpoint."
```

---

### Task 4: Borrar componentes huérfanos del frontend

**Files:**
- Delete: `theycallmebitch/frontend/src/components/ClientesActivosCard.jsx`
- Delete: `theycallmebitch/frontend/src/components/ClientesInactivosCard.jsx`

**Interfaces:**
- Consumes: nada (confirmado en la auditoría que no los importa ningún otro archivo).
- Produces: nada — es una eliminación pura.

- [ ] **Step 1: Confirmar que siguen sin usarse antes de borrar**

```bash
grep -rn "ClientesActivosCard\|ClientesInactivosCard" theycallmebitch/frontend/src --include="*.jsx" | grep -v "ClientesActivosCard.jsx:\|ClientesInactivosCard.jsx:"
```

Expected: sin resultados (ningún archivo fuera de sus propias definiciones los referencia).

- [ ] **Step 2: Borrar**

```bash
git rm theycallmebitch/frontend/src/components/ClientesActivosCard.jsx theycallmebitch/frontend/src/components/ClientesInactivosCard.jsx
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove orphaned ClientesActivosCard/ClientesInactivosCard (dead code, hardcoded value=450, never imported)"
```

---

### Task 5: Simplificar `Clientes.jsx` — consumir los campos del backend, eliminar lo roto/muerto

**Files:**
- Modify: `theycallmebitch/frontend/src/pages/Clientes.jsx`

**Interfaces:**
- Consumes: `getClientes()` (sin cambios de firma en `api.js`) ahora devuelve objetos con `usuario, direccion, telefono, pedidos, total_comprado, ultimo_pedido, primera_compra, estado, tipo, dias_atraso, cadencia_personal_dias` (Task 3).
- Produces: la misma UI visual (cards, tablas, layout) pero sin recálculo local de estado/tipo, sin el menú "⋮", sin los 2 botones de notificaciones que no hacían nada, sin los `console.log` de debug.

Este task es una edición quirúrgica de un archivo grande — **no reescribas el archivo completo**, edita los puntos exactos listados abajo y deja todo lo demás (layout de cards, tablas, animaciones, colores) tal cual está.

- [ ] **Step 1: Reemplazar `calcularEstadoCliente` y la construcción de `clientesData` en `cargarDatos`**

Buscar la función `calcularEstadoCliente` (cerca de la línea 130) — **eliminarla por completo**, ya no hace falta: `estado` viene del backend.

Buscar `parseFecha` (cerca de la línea 74) — se mantiene, todavía se usa para mostrar fechas formateadas.

Buscar la función `cargarDatos` (cerca de la línea 338). Reemplazar todo su contenido desde `try {` hasta el `catch` (el bloque completo que hace `Promise.all([getClientes(), getPedidos()])`, adapta `pedidosData`, adapta `clientesData` con toda la lógica de matching por email/dirección, y los ~40 `console.log`/`console.warn` de debug que le siguen) por:

```javascript
  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [clientesDataRaw, pedidosDataRaw] = await Promise.all([
        getClientes(),
        getPedidos()
      ]);

      const pedidosData = pedidosDataRaw.map((p, idx) => ({
        id: idx + 1,
        usuario: p.usuario || '',
        empresa: p.nombrelocal || '',
        precio: p.precio ? Number(p.precio) : 0,
        fecha: p.fecha || '',
        status: p.status || '',
        dire: p.dire || p.direccion || '',
        ordenpedido: p.ordenpedido || '',
      }));

      // El backend ya agrega por cliente, calcula estado (cadencia personal,
      // igual que el Predictor) y tipo (segmento RFM) — no se recalcula nada acá.
      const clientesData = clientesDataRaw.map((c, idx) => ({
        id: idx + 1,
        nombre: c.direccion && c.direccion.trim() !== '' ? c.direccion.trim() : (c.usuario || `Cliente ${idx + 1}`),
        email: c.usuario || '',
        telefono: c.telefono || '',
        direccion: c.direccion || '',
        estado: c.estado === 'activo' ? 'Activo' : (c.estado === 'en_riesgo' ? 'En Riesgo' : 'Inactivo'),
        tipo: c.tipo || 'Regular',
        pedidos: c.pedidos || 0,
        total_comprado: c.total_comprado || 0,
        ultimo_pedido: c.ultimo_pedido || '',
        primera_compra: c.primera_compra || '',
        dias_atraso: c.dias_atraso || 0,
        cadencia_personal_dias: c.cadencia_personal_dias,
      }));

      setClientes(clientesData);
      setPedidos(pedidosData);
      calcularListas(clientesData, pedidosData);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setError(`Error al cargar datos: ${error.message || 'Error desconocido'}`);
      setClientes([]);
      setPedidos([]);
      setClientesVIP([]);
      setClientesFrecuencia([]);
      setClientesEnRiesgoData([]);
      setClientesVipData([]);
    } finally {
      setLoading(false);
    }
  };
```

Nota: `filteredClientes` (más abajo en el archivo) filtra por `cliente.estado === filterEstado`, y el `<Select>` de filtro de estado en la UI ofrece las opciones `'Todos' | 'Activo' | 'Inactivo'` — verificar ese `<Select>` (buscar `filterEstado`) y **agregar la opción `'En Riesgo'`** junto a las existentes, ya que ahora `estado` puede tomar ese tercer valor (antes el cálculo local solo producía `'Activo'`/`'Inactivo'`, binario).

- [ ] **Step 2: Eliminar `generarClientesEnRiesgoData` y `generarClientesVipData`, simplificar `calcularListas`**

Eliminar por completo las funciones `generarClientesEnRiesgoData` (cerca de la línea 158) y `generarClientesVipData` (cerca de la línea 228) — ya no hace falta recorrer pedidos a mano para esto, `estado` y `total_comprado` ya vienen resueltos por cliente.

En `calcularListas` (cerca de la línea 646), la función agrupaba pedidos y clientes por **dirección** (vía `claveAgrupacion`) para armar `topVIP`/`topFrecuencia` — mantener esa función tal cual (esa deduplicación por dirección es un problema real y separado, fuera de este alcance), **pero** quitarle el recálculo de `estado` interno (buscar la línea `const estado = calcularEstadoCliente(fechaFinal);` dentro de `calcularListas` y su bloque de debug de "Walker" inmediatamente después — eliminar ambos) y usar directamente `cliente.estado` (ya viene del backend) en el objeto que arma `clientesEnriquecidos`.

Al final de `calcularListas`, donde llama a `generarClientesEnRiesgoData(clientesData, pedidosData)` y `generarClientesVipData(clientesVIPyFrecuenciaTemp, pedidosData)` — reemplazar esas dos líneas por:

```javascript
    const riesgoData = clientesData.filter(c => c.estado === 'En Riesgo');
    const vipData = clientesVIPyFrecuenciaTemp;

    setClientesEnRiesgoData(riesgoData);
    setClientesVipData(vipData);
```

- [ ] **Step 3: Eliminar los `console.log`/`console.warn` de debug restantes**

Buscar y eliminar cualquier `console.log`/`console.warn` que quede fuera de los bloques `catch` (los de manejo real de errores se mantienen). Esto incluye los logs de verificación de KPIs, ejemplos de clientes/pedidos, y cualquier logging de diagnóstico que haya sobrevivido a los Steps 1-2. Verificar con:

```bash
grep -n "console\.\(log\|warn\)" theycallmebitch/frontend/src/pages/Clientes.jsx
```

Cada resultado debe estar dentro de un bloque `catch` de manejo de errores real — si alguno no lo está, eliminarlo.

- [ ] **Step 4: Eliminar el menú "⋮" de acciones por cliente**

En el componente `TablaClientes` (buscar `const TablaClientes = `), eliminar la última `<TableCell>` de cada fila (la que contiene `<IconButton onClick={handleMenuClick}><MoreVertIcon .../></IconButton>`) y su `<TableCell>` de encabezado correspondiente (`<TableCell ...>Acciones</TableCell>`). Hacer lo mismo en la tabla principal paginada (buscar el segundo lugar donde aparece `<TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Acciones</TableCell>` y su `<IconButton onClick={handleMenuClick}>` correspondiente, alrededor de la línea 2727).

Eliminar las funciones `handleMenuClick`/`handleMenuClose` y el estado `anchorEl` si ya no los usa nada más después de quitar el menú (verificar con `grep -n "anchorEl\|handleMenuClick\|handleMenuClose" theycallmebitch/frontend/src/pages/Clientes.jsx` tras el cambio — si solo quedan la declaración y ningún uso, eliminarlas también). Buscar y eliminar el `<Menu anchorEl={anchorEl} ...>` con sus `<MenuItem>` ("Ver Detalles", "Editar Cliente", "Ver Pedidos", "Eliminar") si existe como JSX separado del `IconButton` inline.

- [ ] **Step 5: Eliminar los 2 botones de notificaciones que no hacen nada**

Buscar `Marcar todas como leídas` y `Ver todas` dentro del `Popover` de notificaciones (alrededor de la línea 2285-2323). Eliminar ambos `<Button>` completos (y el `<Divider>`/`<Box>` que los envuelve si queda vacío tras sacarlos) — la lista de notificaciones informativas se mantiene, solo se sacan estos dos botones sin acción real detrás.

- [ ] **Step 6: Unificar "cliente nuevo" a 75 días**

Buscar dentro de `generarNotificaciones` (alrededor de la línea 1389) el bloque `const clientesNuevos = (() => { ... if (diff <= 30) count++; ... })();` usado solo para el mensaje de notificación — cambiar `diff <= 30` por `diff <= 75` para que coincida con el KPI card "Clientes Nuevos (75 días)". Confirmar que el mensaje de la notificación (`mensaje: \`${clientesNuevos} nuevos clientes en los últimos 30 días\``) también se actualiza a `75 días` para que el texto no contradiga el número.

- [ ] **Step 7: Verificar en el navegador**

Con el backend (`localhost:8001`) y frontend (`localhost:5175`) corriendo:

1. Ir a `/clientes`.
2. Confirmar que la tabla principal carga con datos reales, sin columna "Acciones"/menú "⋮".
3. Confirmar en la consola del navegador que no hay errores, y que no quedan los `console.log` de debug de antes.
4. Confirmar que el filtro de Estado ahora incluye "En Riesgo" como opción y funciona.
5. Abrir la campanita de notificaciones — confirmar que ya no aparecen los botones "Marcar todas como leídas"/"Ver todas".
6. Confirmar que al menos un cliente tiene `tipo: VIP` visible en el badge de la tabla (si el dataset real tiene algún cliente en segmento Campeón/Leal).

- [ ] **Step 8: Commit**

```bash
git add theycallmebitch/frontend/src/pages/Clientes.jsx
git commit -m "refactor: Clientes.jsx consumes backend-aggregated fields, removes dead menu/buttons/debug logs

estado and tipo now come from /clientes (customer_risk_service +
RFM segment) instead of a duplicated 75-day threshold recalculated
5 times client-side. Removes the fake action menu, the two
no-op notification buttons, 40+ debug console.logs, and the
Walker-specific debug hack."
```

---

### Task 6: Revisión final y verificación end-to-end

**Files:** ninguno nuevo — solo verificación.

- [ ] **Step 1: Correr toda la suite de tests backend**

```bash
cd theycallmebitch/backend
python -m pytest test_rfm_engine.py test_customer_profile_service.py test_customer_risk_service.py test_demand_forecast_service.py -v
```

Expected: todos PASS (los de Predictor no deben haberse roto por los cambios a `rfm_engine.py`).

- [ ] **Step 2: Verificar que no quedan referencias a lo eliminado**

```bash
grep -rn "extraer_clientes_de_pedidos\|fetch_clientes_antiguos\|ENDPOINT_CLIENTES_ANTIGUO\|clientes_antiguos_cache\|obtener_clientes_combinados\|combinar_clientes" theycallmebitch/backend/
grep -rn "ClientesActivosCard\|ClientesInactivosCard" theycallmebitch/frontend/src/
grep -n "calcularEstadoCliente\|generarClientesEnRiesgoData\|generarClientesVipData" theycallmebitch/frontend/src/pages/Clientes.jsx
```

Expected: sin resultados en los tres.

- [ ] **Step 3: Verificar visualmente `/clientes` una vez más end-to-end**, con foco en que ningún cliente muestre `localoficial` ni campos legacy, que las tablas Top 15 VIP/Frecuencia sigan funcionando, y que la paginación de la tabla principal siga funcionando.
