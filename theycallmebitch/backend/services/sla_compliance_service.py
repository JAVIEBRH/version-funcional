"""
Servicio de cumplimiento de promesa de entrega (SLA).

% real de pedidos entregados dentro de su ventana horaria prometida.

La forma en que se agenda/registra la hora difiere entre pedidos antiguos
(pre-migración, snapshot local) y pedidos nuevos (API Mongo actual):

- Pedidos antiguos: `horaagenda` es un RANGO ("18:00 - 19:00"), que es la
  promesa misma tal como el negocio siempre la ha comunicado al cliente
  ("entre las 6 y las 7"). `horaentrega` es una hora sin fecha ("18:10"),
  por lo que la fecha se reconstruye desde el campo `fecha` del mismo
  registro. Un pedido se considera cumplido si la entrega cae dentro de
  ese rango, sin tolerancia adicional (la ventana ya ES la promesa).
- Pedidos nuevos: `horaagenda` es un punto único 12h AM/PM ("12:00 PM").
  Aunque el sistema nuevo solo registra un instante, el negocio tampoco
  promete un instante exacto en este caso — se trata como una ventana
  implícita de ±TOLERANCIA_MINUTOS alrededor de ese punto. `horaentrega`
  es un datetime ISO completo con sufijo Z.

Alcance deliberadamente acotado: solo el porcentaje de cumplimiento
combinado (ambos formatos), no un score de desempeño individual por
repartidor.
"""
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

TOLERANCIA_MINUTOS = 60

# Los pedidos nuevos guardan `deliveredAt` en UTC (sufijo 'Z'), mientras que
# `horaagenda` (deliverySchedule.hour) es hora local de Chile. data_adapter.py
# usa este mismo offset fijo UTC-4 para convertir `createdAt`; se reutiliza
# aquí para no comparar un instante UTC contra un punto local sin convertir
# (lo que produciría un desfase de ~3-4h y marcaría como "atrasados" pedidos
# que en realidad llegaron a tiempo).
CHILE_TZ = timezone(timedelta(hours=-4))

_RANGO_RE = re.compile(r'^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$')
_AMPM_RE = re.compile(r'^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$', re.IGNORECASE)
_HHMM_RE = re.compile(r'^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$')


def _parsear_fecha_registro(fecha_str: Optional[str]) -> Optional[datetime]:
    """Parsea el campo `fecha` del pedido, formato 'dd-mm-YYYY'."""
    if not fecha_str:
        return None
    try:
        return datetime.strptime(str(fecha_str).strip(), '%d-%m-%Y')
    except (ValueError, TypeError):
        return None


def _es_formato_nuevo(horaagenda: str) -> bool:
    """Discrimina formato nuevo (punto AM/PM) de formato antiguo (rango 24h)."""
    return bool(_AMPM_RE.match(horaagenda))


def _parsear_rango_horaagenda(
    valor: str, fecha_base: datetime
) -> Optional[Tuple[datetime, datetime]]:
    """Parsea un rango tipo '18:00 - 19:00' combinado con fecha_base -> (inicio, fin)."""
    m = _RANGO_RE.match(valor)
    if not m:
        return None
    try:
        h1, m1, h2, m2 = (int(x) for x in m.groups())
        inicio = fecha_base.replace(hour=h1, minute=m1, second=0, microsecond=0)
        fin = fecha_base.replace(hour=h2, minute=m2, second=0, microsecond=0)
        if fin < inicio:
            # Rango que cruzaría medianoche (ej. '23:30 - 00:15'): caso raro y
            # ambiguo respecto a qué día corresponde el fin. Se descarta el
            # registro en vez de adivinar, en lugar de marcarlo mal silenciosamente.
            return None
        return inicio, fin
    except ValueError:
        return None


def _parsear_punto_horaagenda(valor: str, fecha_base: datetime) -> Optional[datetime]:
    """Parsea un punto único 12h AM/PM tipo '12:00 PM' combinado con fecha_base."""
    m = _AMPM_RE.match(valor)
    if not m:
        return None
    try:
        hora, minuto, meridiano = int(m.group(1)), int(m.group(2)), m.group(3).upper()
        if not (1 <= hora <= 12) or not (0 <= minuto <= 59):
            return None
        if meridiano == 'AM':
            hora_24 = 0 if hora == 12 else hora
        else:
            hora_24 = 12 if hora == 12 else hora + 12
        return fecha_base.replace(hour=hora_24, minute=minuto, second=0, microsecond=0)
    except ValueError:
        return None


def _parsear_hora_entrega_legacy(valor: str, fecha_base: datetime) -> Optional[datetime]:
    """Parsea una hora sin fecha tipo '18:10' (o '18:10:05') combinada con fecha_base."""
    m = _HHMM_RE.match(valor)
    if not m:
        return None
    try:
        hora, minuto = int(m.group(1)), int(m.group(2))
        segundo = int(m.group(3)) if m.group(3) else 0
        if not (0 <= hora <= 23) or not (0 <= minuto <= 59):
            return None
        return fecha_base.replace(hour=hora, minute=minuto, second=segundo, microsecond=0)
    except ValueError:
        return None


def _parsear_hora_entrega_iso(valor: str) -> Optional[datetime]:
    """Parsea un datetime ISO completo (formato nuevo, típicamente UTC con 'Z')
    y lo convierte a hora local de Chile, para que sea comparable contra
    `horaagenda` (que siempre es hora local)."""
    try:
        dt = datetime.fromisoformat(str(valor).replace('Z', '+00:00'))
        if dt.tzinfo is not None:
            dt = dt.astimezone(CHILE_TZ)
        return dt.replace(tzinfo=None)
    except (ValueError, AttributeError):
        return None


def _evaluar_pedido(pedido: Dict) -> Optional[Tuple[bool, bool]]:
    """Evalúa un pedido individual.

    Retorna (cumplido, es_formato_nuevo) o None si el registro no es
    evaluable (datos faltantes o malformados).
    """
    horaagenda = str(pedido.get('horaagenda') or '').strip()
    horaentrega = str(pedido.get('horaentrega') or '').strip()
    if not horaagenda or not horaentrega:
        return None

    fecha_base = _parsear_fecha_registro(pedido.get('fecha'))

    if _es_formato_nuevo(horaagenda):
        # Formato nuevo: punto AM/PM + entrega ISO completa. La fecha de la
        # promesa se toma del propio horaentrega (ya trae fecha), para
        # comparar ambos instantes en el mismo día real sin depender de
        # que `fecha` esté también bien formada.
        entrega_dt = _parsear_hora_entrega_iso(horaentrega)
        if entrega_dt is None:
            return None
        agenda_dt = _parsear_punto_horaagenda(horaagenda, entrega_dt)
        if agenda_dt is None:
            return None
        diferencia_min = abs((entrega_dt - agenda_dt).total_seconds()) / 60
        return diferencia_min <= TOLERANCIA_MINUTOS, True

    # Formato antiguo: rango 24h + entrega sin fecha, requiere `fecha` del registro.
    if fecha_base is None:
        return None
    rango = _parsear_rango_horaagenda(horaagenda, fecha_base)
    if rango is None:
        return None
    entrega_dt = _parsear_hora_entrega_legacy(horaentrega, fecha_base)
    if entrega_dt is None:
        return None
    inicio, fin = rango
    return inicio <= entrega_dt <= fin, False


def calcular_cumplimiento_horario(pedidos: List[Dict]) -> Dict:
    evaluados_legacy = 0
    cumplidos_legacy = 0
    evaluados_nuevos = 0
    cumplidos_nuevos = 0

    for pedido in pedidos:
        if str(pedido.get('nombrelocal', '')).strip().lower() not in ('', 'aguas ancud'):
            continue
        try:
            resultado = _evaluar_pedido(pedido)
        except Exception as e:
            logger.warning(f"Pedido no evaluable para SLA, se omite: {e}")
            continue
        if resultado is None:
            continue

        cumplido, es_nuevo = resultado
        if es_nuevo:
            evaluados_nuevos += 1
            if cumplido:
                cumplidos_nuevos += 1
        else:
            evaluados_legacy += 1
            if cumplido:
                cumplidos_legacy += 1

    evaluados = evaluados_legacy + evaluados_nuevos
    cumplidos = cumplidos_legacy + cumplidos_nuevos

    if evaluados == 0:
        return {
            "pedidos_evaluados": 0,
            "pedidos_evaluados_legacy": 0,
            "pedidos_evaluados_nuevos": 0,
            "pct_cumplimiento": None,
        }

    return {
        "pedidos_evaluados": evaluados,
        "pedidos_cumplidos": cumplidos,
        "pct_cumplimiento": round((cumplidos / evaluados) * 100, 1),
        "pedidos_evaluados_legacy": evaluados_legacy,
        "pedidos_cumplidos_legacy": cumplidos_legacy,
        "pedidos_evaluados_nuevos": evaluados_nuevos,
        "pedidos_cumplidos_nuevos": cumplidos_nuevos,
    }
