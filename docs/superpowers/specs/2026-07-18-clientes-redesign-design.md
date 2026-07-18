# Rediseño del módulo Clientes — Diseño

Fecha: 2026-07-18
Estado: aprobado por el usuario, pendiente de plan de implementación

## Contexto

Auditoría completa del módulo Clientes (`frontend/src/pages/Clientes.jsx`, 3180
líneas, más `backend/main.py:376` `GET /clientes`) encontró que **no existe una
base de datos de clientes real**:

- El endpoint legacy que debía traer los perfiles de clientes
  (`https://fluvi.cl/fluviDos/GoApp/endpoints/clientes.php`) está **muerto
  (verificado en vivo: HTTP 404)**, no solo desactualizado.
- `data_adapter.py:429`: `clientes_nuevos = []  # Por ahora no hay endpoint de
  clientes nuevos` — nunca se construyó una fuente de clientes desde el
  sistema nuevo (MongoDB).
- Cuando la fuente legacy falla, `main.py`'s `/clientes` cae a
  `extraer_clientes_de_pedidos()`, que toma el **primer** pedido de cada
  email único y congela ahí nombre/teléfono/dirección para siempre —
  verificado en vivo: los 429 "clientes" actuales llevan
  `localoficial: "wgxlp3dB1YxbdmT"` (string hardcodeado del fallback) y
  nombres como `"riocru9047"` (prefijo de un email autogenerado por la app,
  no un nombre real).
- **No hay dato de nombre real en ningún lado del sistema.** Se verificó
  contra la API en vivo: el campo `customer.name` de los pedidos casi
  siempre viene vacío, y cuando no está vacío contiene una **dirección**
  mal cargada ahí (ej. `"rio colegual 4973"`), no un nombre de persona. El
  mejor identificador real disponible es la dirección — que es justamente
  lo que la UI actual ya prioriza mostrar (`Clientes.jsx:952-956`), así que
  esa parte de la UI no cambia.
- `estado` (Activo/Inactivo) se calcula en el frontend con un umbral fijo de
  75 días para todos los clientes, duplicado en al menos 5 funciones
  distintas del archivo, con un caso de desincronización real ya detectado
  (75 días en el KPI card de "Clientes Nuevos" vs 30 días en la notificación
  de la campanita, mismo nombre de variable).
- `tipo` está hardcodeado a `'Regular'` siempre (`Clientes.jsx:431`) — el
  badge "VIP" que se ve en otras tablas nunca sale de este campo.
- El backend ya tiene dos motores de clientes reales y probados que este
  módulo ignora por completo:
  - `services/customer_risk_service.py` — cadencia personal por cliente +
    probabilidad empírica de reorden, ya usado por `/predictor/clientes-riesgo`.
  - `services/rfm_engine.py` — 8 segmentos RFM (Campeón, Leal, etc.), ya
    usado por `/rfm`, pero hoy solo expone top-10 por categoría, no el
    segmento de **todos** los clientes.
- UI muerta: menú "⋮" con 4 opciones (Ver Detalles/Editar/Ver
  Pedidos/Eliminar) que no hacen nada; botones de notificaciones
  ("Marcar todas como leídas", "Ver todas") que solo hacen `console.log`;
  componentes huérfanos `ClientesActivosCard.jsx`/`ClientesInactivosCard.jsx`
  (nunca importados, `value` por defecto hardcodeado en 450); 40+
  `console.log`/`console.warn` de debug permanentes, incluyendo un hack
  dedicado a un cliente llamado "Walker".

## Objetivo

Reemplazar la reconstrucción ingenua de clientes por una agregación
correcta en el backend, reutilizando los motores ya construidos y
probados este mismo día para el Predictor, y reducir
`frontend/src/pages/Clientes.jsx` a fetch + render — mismo patrón que ya se
aplicó en el rediseño del Predictor (1639 → 72 líneas).

## Arquitectura

### 1. Perfil de cliente — agregación correcta, no "primer pedido gana"

Nuevo módulo `backend/services/customer_profile_service.py`:

- Agrupa **todos** los pedidos de Aguas Ancud por `usuario` (email).
- Usa el pedido **más reciente** de cada cliente para dirección y teléfono
  (no el primero) — si el cliente se mudó o cambió de número, se refleja.
- `nombre` para mostrar: usar la **dirección** como identificador principal
  (ya es lo que la UI actual hace cuando hay dirección disponible); si no
  hay dirección, usar el email. No se inventa un "nombre" que no existe en
  los datos.
- Calcula `pedidos_count` (total real de pedidos) y `total_comprado` (suma
  real, no promedio) — campos que `customer_risk_service` no expone hoy
  (solo expone `gasto_promedio`).
- Fecha de primera compra por cliente (necesaria para "cliente nuevo").

### 2. Estado (Activo / En riesgo / Inactivo) — reusar `customer_risk_service`

En vez de un umbral fijo de 75 días, `/clientes` reutiliza
`customer_risk_service.calcular_riesgo_clientes()` (cadencia personal +
probabilidad empírica de reorden) para clasificar `estado` — la misma
fuente de verdad que ya usa el Predictor. Esto es una llamada a una función
que ya existe y ya está probada; no se reescribe su lógica.

### 3. Tipo (VIP / Regular) — reusar `rfm_engine`, extendido

`rfm_engine.calcular_rfm()` hoy solo devuelve top-10 por categoría, no el
segmento de cada cliente. Se **extiende** (cambio aditivo, no rompe
`/rfm` ni ningún consumidor existente) para además devolver un mapa
`segmento_por_cliente: {usuario: segmento}` con el segmento de **todos**
los clientes evaluados, no solo el top 10.

`/clientes` marca `tipo: 'VIP'` cuando `segmento` es `'campeon'` o `'leal'`,
`'Regular'` en cualquier otro caso.

### 4. "Cliente nuevo" — una sola definición

Unificar a 75 días (coincide con el umbral que ya usa el resto de la
página para "activo"). Se elimina la definición de 30 días que solo vivía
en la notificación de la campanita.

### 5. Endpoint `/clientes` — reescrito

`GET /clientes` deja de llamar al endpoint legacy muerto (se borra esa
llamada de red que siempre falla con timeout de 10s) y deja de usar
`extraer_clientes_de_pedidos()`. Nueva forma de respuesta por cliente:

```json
{
  "usuario": "riocru9047@fluvi.cl",
  "direccion": "rio cruces 4832, puente alto, Chile",
  "telefono": "987459047",
  "estado": "activo",
  "tipo": "Regular",
  "pedidos": 12,
  "total_comprado": 240000,
  "ultimo_pedido": "17-07-2026",
  "primera_compra": "10-01-2025",
  "dias_atraso": 0,
  "cadencia_personal_dias": 14.0
}
```

Se eliminan del payload los campos legacy sin sentido real:
`clave`, `verificar`, `notifictoken`, `dispositivo`, `v`, `localoficial`,
`deptoblock`, `idcliente` duplicado de `id`.

### 6. Frontend — `Clientes.jsx` se reduce a fetch + render

Con el backend devolviendo clientes ya agregados y ya clasificados,
desaparecen del frontend: las ~5 copias de umbral de días
(`calcularEstadoCliente` y sus variantes inline), `generarClientesEnRiesgoData`,
`generarClientesVipData`, toda la lógica de matching pedido↔cliente por
email/dirección, los 40+ `console.log` de debug, el hack de "Walker".

Las tablas (Top 15 VIP, Top 15 Frecuencia, Clientes en Riesgo, tabla
principal paginada) siguen existiendo con el mismo diseño visual, pero
leen directamente de lo que ya viene calculado del backend en vez de
recalcularlo client-side.

### 7. Limpieza de UI muerta

- Menú "⋮" por cliente: se elimina completo (decidido con el usuario —
  no hay backing store real para "editar" o "eliminar" un cliente
  sintético; si se necesita en el futuro es un proyecto aparte).
- Botones de notificaciones que solo hacen `console.log`: se eliminan o
  se dejan de renderizar si no tienen una acción real detrás.
- Se borran `ClientesActivosCard.jsx` y `ClientesInactivosCard.jsx`
  (huérfanos, nunca importados, con `450` hardcodeado).

## Qué se elimina

- `backend/data_adapter.py`: llamada HTTP a `ENDPOINT_CLIENTES_ANTIGUO`
  (siempre 404, timeout de 10s desperdiciado en cada refresh de cache) y
  `fetch_clientes_antiguos()`.
- `backend/main.py`: `extraer_clientes_de_pedidos()` (reemplazada por
  `customer_profile_service`).
- `frontend/src/components/ClientesActivosCard.jsx`,
  `ClientesInactivosCard.jsx`.
- Menú "⋮" de acciones por cliente en `Clientes.jsx`.
- Las ~5 implementaciones duplicadas del umbral de días "activo/inactivo"
  y la definición de 30 días para "cliente nuevo".
- Los 40+ `console.log`/`console.warn` de debug y el hack de "Walker
  Martinez".

## Fuera de alcance

- Editar o eliminar clientes de verdad — no hay una base de datos de
  clientes que respalde esas acciones; sería un proyecto aparte que
  primero requeriría decidir qué significa "editar" un perfil que hoy es
  100% derivado de pedidos.
- Recuperar nombres reales de clientes — no existen en los datos de
  origen (verificado en vivo contra la API), no es un problema que este
  rediseño pueda resolver con los datos actuales.
- Restaurar el endpoint legacy — está permanentemente muerto (404), no es
  un problema de configuración.

## Testing

- Backend: tests para `customer_profile_service.py` (agregación por
  cliente, usa el pedido más reciente para contacto, no el primero;
  `pedidos_count`/`total_comprado` correctos; cliente sin pedidos no
  rompe) y para la extensión de `rfm_engine.py` (el nuevo
  `segmento_por_cliente` cubre a todos los clientes evaluados, no solo
  el top 10; `/rfm` sigue devolviendo exactamente lo mismo que antes para
  no romper ningún consumidor existente).
- Verificar con `curl` que `/clientes` responde en tiempo razonable y que
  ya no hay ningún cliente con `localoficial` hardcodeado o nombre tipo
  email-prefix cuando existe una dirección real.
- Verificar visualmente en `/clientes` que las tablas cargan con datos
  reales, sin consola con errores, sin el menú "⋮", y que "Clientes
  Nuevos" muestra el mismo número en el KPI y en cualquier notificación
  relacionada.
