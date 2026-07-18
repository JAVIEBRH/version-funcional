"""
Capa de adaptación de datos para unificar formatos antiguos y nuevos
Mantiene compatibilidad total con el frontend existente
"""

import os
import requests
import json
from datetime import datetime
from typing import List, Dict, Optional
from pydantic import BaseModel, Field
import logging

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# URLs de los endpoints
ENDPOINT_PEDIDOS_ANTIGUO = "https://fluvi.cl/fluviDos/GoApp/endpoints/pedidos.php"
ENDPOINT_PEDIDOS_NUEVO = "https://gobackend-qomm.onrender.com/api/store/orders"
STORE_ID = "68697bf9c8e5172fd536738f"

HEADERS = {"User-Agent": "Mozilla/5.0"}

# Snapshot local con pedidos previos a la migración al backend nuevo.
# El endpoint legacy en vivo (ENDPOINT_PEDIDOS_ANTIGUO) dejó de responder (404),
# así que este archivo es la única fuente de esos pedidos antiguos.
RUTA_SNAPSHOT_PEDIDOS_ANTIGUOS = os.path.join(os.path.dirname(__file__), '..', 'datos_pedidos.json')

# La API nueva ya tiene cobertura completa desde esta fecha en adelante.
# Se usa para no contar dos veces los pedidos que están tanto en el snapshot
# local como en la API nueva.
FECHA_CORTE_SNAPSHOT = datetime(2025, 8, 13)

# Modelos Pydantic para validación
class PedidoAntiguo(BaseModel):
    id: str
    idpedido: Optional[str] = None
    precio: str
    fecha: str
    dia: Optional[str] = None
    mes: Optional[str] = None
    ano: Optional[str] = None
    fechamostrar: Optional[str] = None
    hora: Optional[str] = None
    horaagenda: Optional[str] = None
    ordenpedido: Optional[str] = None
    metodopago: str
    usuario: str
    telefonou: Optional[str] = None
    lat: Optional[str] = None
    lon: Optional[str] = None
    dire: str
    comuna: Optional[str] = None
    deptoblock: Optional[str] = None
    observacion: Optional[str] = None
    notific: Optional[str] = None
    status: str
    retirolocal: Optional[str] = None
    userdelivery: Optional[str] = None
    tokendelivery: Optional[str] = None
    despachador: Optional[str] = None
    observaciondos: Optional[str] = None
    calific: Optional[str] = None
    nombrelocal: str
    logo: Optional[str] = None
    pagofinal: Optional[str] = None
    transferpay: Optional[str] = None
    prov: Optional[str] = None
    horaentrega: Optional[str] = None

class ClienteAntiguo(BaseModel):
    id: str
    idcliente: str
    nombre: str
    correo: str
    clave: Optional[str] = None
    direc: str
    comuna: Optional[str] = None
    deptoblock: Optional[str] = None
    lat: Optional[str] = None
    lon: Optional[str] = None
    telefono: str
    verificar: Optional[str] = None
    notifictoken: Optional[str] = None
    fecha: Optional[str] = None
    dia: Optional[str] = None
    mes: Optional[str] = None
    ano: Optional[str] = None
    localoficial: Optional[str] = None
    dispositivo: Optional[str] = None
    v: Optional[str] = None

class PedidoNuevo(BaseModel):
    _id: str
    storeId: str
    commerceId: Optional[str] = None
    orderCode: Optional[str] = None
    legacyId: Optional[int] = None
    price: float
    finalPrice: Optional[float] = None
    createdAt: str
    updatedAt: Optional[str] = None
    deliveryDate: Optional[str] = None
    deliveredAt: Optional[str] = None
    deliverySchedule: Optional[Dict] = None
    products: List[Dict] = []
    paymentMethod: str
    transferPay: Optional[bool] = None
    status: str
    deliveryType: str
    origin: Optional[str] = None
    customer: Dict
    deliveryPerson: Optional[Dict] = None
    merchantObservation: Optional[str] = None
    deliveryObservation: Optional[str] = None
    rating: Optional[Dict] = None

class DataAdapter:
    """Adaptador principal para unificar datos antiguos y nuevos"""
    
    def __init__(self):
        self.pedidos_antiguos_cache = None
        self.pedidos_nuevos_cache = None
        self.cache_timestamp = None
        self.cache_duration = 1800  # 30 minutos
    
    def _is_cache_valid(self) -> bool:
        """Verifica si el cache es válido"""
        if not self.cache_timestamp:
            return False
        return (datetime.now().timestamp() - self.cache_timestamp) < self.cache_duration
    
    def fetch_pedidos_antiguos(self) -> List[Dict]:
        """Obtiene pedidos previos a la migración desde el snapshot local.

        El endpoint legacy en vivo (fluvi.cl) dejó de responder (404), por lo
        que los pedidos anteriores a FECHA_CORTE_SNAPSHOT se leen de
        datos_pedidos.json. Solo se devuelven pedidos anteriores a esa fecha
        de corte para no duplicar los que la API nueva ya cubre.
        """
        try:
            logger.info("Cargando snapshot local de pedidos antiguos...")
            with open(RUTA_SNAPSHOT_PEDIDOS_ANTIGUOS, 'r', encoding='utf-8-sig') as f:
                data = json.load(f)
            pedidos = data.get('value', []) if isinstance(data, dict) else data

            pedidos_filtrados = []
            for pedido in pedidos:
                try:
                    fecha = datetime.strptime(pedido.get('fecha', ''), '%d-%m-%Y')
                    if fecha < FECHA_CORTE_SNAPSHOT:
                        pedidos_filtrados.append(pedido)
                except (ValueError, TypeError):
                    continue

            logger.info(
                f"Pedidos antiguos del snapshot (antes de {FECHA_CORTE_SNAPSHOT.date()}): "
                f"{len(pedidos_filtrados)} de {len(pedidos)} registros totales en el archivo"
            )
            return pedidos_filtrados
        except Exception as e:
            logger.error(f"Error cargando snapshot de pedidos antiguos: {e}")
            return []
    
    def fetch_pedidos_nuevos(self) -> List[Dict]:
        """Obtiene TODOS los pedidos del endpoint nuevo (MongoDB), paginando.

        Antes se pedía una sola página con limit=2000: en cuanto la tienda
        superó los 2000 pedidos, los más antiguos empezaron a quedar fuera
        de la ventana y el total dejó de crecer. Ahora se recorren todas
        las páginas que reporte la API (totalPages) para traer el conjunto
        completo, sin importar cuánto crezca a futuro.
        """
        try:
            logger.info("Obteniendo pedidos del endpoint nuevo (paginado completo)...")
            limit = 500
            pedidos: List[Dict] = []
            page = 1
            total_pages = 1

            while page <= total_pages:
                url = f"{ENDPOINT_PEDIDOS_NUEVO}?storeId={STORE_ID}&limit={limit}&page={page}"
                response = requests.get(url, timeout=15)
                response.raise_for_status()
                data = response.json()
                if not data.get('success'):
                    break

                pagina = data.get('data', {})
                pedidos.extend(pagina.get('docs', []))
                total_pages = pagina.get('totalPages', 1)
                page += 1

            logger.info(f"Pedidos nuevos obtenidos: {len(pedidos)} registros ({total_pages} páginas)")
            return pedidos
        except Exception as e:
            logger.error(f"Error obteniendo pedidos nuevos: {e}")
            return []
    
    def convertir_pedido_nuevo_a_antiguo(self, pedido_nuevo: Dict) -> Dict:
        """Convierte un pedido del formato nuevo al formato antiguo"""
        try:
            # Parsear fecha ISO (con soporte de milisegundos y zona horaria Chile UTC-4)
            fecha_iso = pedido_nuevo.get('createdAt', '')
            fecha_dt = None
            if fecha_iso:
                try:
                    # Eliminar milisegundos antes de parsear (fromisoformat no los soporta en Python < 3.11)
                    fecha_clean = fecha_iso.replace('Z', '+00:00')
                    if '.' in fecha_clean:
                        parte_fecha = fecha_clean.split('.')[0]
                        fecha_clean = parte_fecha + '+00:00'
                    fecha_dt = datetime.fromisoformat(fecha_clean)
                    # Convertir de UTC a hora local Chile (UTC-4)
                    from datetime import timezone, timedelta
                    CHILE_TZ = timezone(timedelta(hours=-4))
                    fecha_dt = fecha_dt.astimezone(CHILE_TZ)
                except Exception as e:
                    logger.warning(f"Error parseando fecha ISO '{fecha_iso}': {e}, usando fecha actual")
                    fecha_dt = datetime.now()
            
            # Extraer datos del customer (puede venir como null explícito en ventas
            # de mostrador sin cliente asociado, no solo ausente)
            customer = pedido_nuevo.get('customer') or {}
            
            # Convertir deliverySchedule
            delivery_schedule = pedido_nuevo.get('deliverySchedule', {})
            hora_agenda = delivery_schedule.get('hour', '') if delivery_schedule else ''
            
            # Convertir products a ordenpedido (cantidad de bidones)
            products = pedido_nuevo.get('products', [])
            if products:
                # Sumar la cantidad de todos los productos
                total_cantidad = sum(product.get('quantity', 1) for product in products)
                orden_pedido = str(total_cantidad)
            else:
                # Si no hay productos, calcular basado en el precio real
                precio = pedido_nuevo.get('price', 0)
                if precio > 0:
                    # Precio real: $2000 por bidón para delivery
                    bidones_calculados = max(1, round(precio / 2000))
                    orden_pedido = str(bidones_calculados)
                else:
                    orden_pedido = '1'
            
            # Mapear deliveryType a retirolocal
            delivery_type = pedido_nuevo.get('deliveryType', 'domicilio')
            retiro_local = 'no' if delivery_type == 'domicilio' else 'si'
            
            # Mapear transferPay
            transfer_pay = pedido_nuevo.get('transferPay', False)
            transfer_pay_str = 'si' if transfer_pay else ''
            
            # Extraer deliveryPerson
            delivery_person = pedido_nuevo.get('deliveryPerson', {})
            
            # Extraer rating (could be None)
            rating = pedido_nuevo.get('rating') or {}
            
            # Construir pedido en formato antiguo
            pedido_antiguo = {
                'id': pedido_nuevo.get('_id', ''),
                'idpedido': pedido_nuevo.get('orderCode', ''),
                'precio': str(pedido_nuevo.get('price', 0)),
                'fecha': fecha_dt.strftime('%d-%m-%Y') if fecha_dt else '',
                'dia': fecha_dt.strftime('%d') if fecha_dt else '',
                'mes': fecha_dt.strftime('%m') if fecha_dt else '',
                'ano': fecha_dt.strftime('%Y') if fecha_dt else '',
                'fechamostrar': fecha_dt.strftime('%A, %d') if fecha_dt else '',
                'hora': fecha_dt.strftime('%H:%M:%S') if fecha_dt else '',
                'horaagenda': hora_agenda,
                'ordenpedido': orden_pedido,
                'metodopago': pedido_nuevo.get('paymentMethod', ''),
                'usuario': customer.get('email', ''),
                'telefonou': customer.get('phone', ''),
                'lat': str(customer.get('lat', '')),
                'lon': str(customer.get('lon', '')),
                'dire': customer.get('address', ''),
                'comuna': customer.get('address', '').split(',')[-1].strip() if customer.get('address') else '',
                'deptoblock': customer.get('block', ''),
                'observacion': customer.get('observations', ''),
                'notific': customer.get('notificationToken', ''),
                'status': pedido_nuevo.get('status', ''),
                'retirolocal': retiro_local,
                'userdelivery': delivery_person.get('id', ''),
                'tokendelivery': delivery_person.get('token', ''),
                'despachador': delivery_person.get('name', ''),
                'observaciondos': pedido_nuevo.get('merchantObservation', ''),
                'calific': str(rating.get('value', '')),
                'nombrelocal': 'Aguas Ancud',
                'logo': '',
                'pagofinal': pedido_nuevo.get('paymentMethod', ''),
                'transferpay': transfer_pay_str,
                'prov': pedido_nuevo.get('origin', ''),
                'horaentrega': pedido_nuevo.get('deliveredAt', '')
            }
            
            return pedido_antiguo
            
        except Exception as e:
            logger.error(f"Error convirtiendo pedido nuevo: {e}")
            return {}
    
    def convertir_cliente_nuevo_a_antiguo(self, cliente_nuevo: Dict) -> Dict:
        """Convierte un cliente del formato nuevo al formato antiguo"""
        # Por ahora, los clientes nuevos se extraen de los pedidos
        # Si hay un endpoint específico de clientes nuevos, se implementaría aquí
        return {}
    
    def combinar_pedidos(self, pedidos_antiguos: List[Dict], pedidos_nuevos: List[Dict]) -> List[Dict]:
        """Combina pedidos antiguos y nuevos, ordenados por fecha"""
        try:
            # Convertir pedidos nuevos al formato antiguo
            pedidos_nuevos_convertidos = []
            for pedido_nuevo in pedidos_nuevos:
                pedido_convertido = self.convertir_pedido_nuevo_a_antiguo(pedido_nuevo)
                if pedido_convertido:
                    pedidos_nuevos_convertidos.append(pedido_convertido)
            
            # Combinar ambos conjuntos
            todos_los_pedidos = pedidos_antiguos + pedidos_nuevos_convertidos
            
            # Ordenar por fecha (más recientes primero)
            def parse_fecha_para_ordenar(pedido):
                try:
                    fecha_str = pedido.get('fecha', '')
                    if fecha_str:
                        return datetime.strptime(fecha_str, '%d-%m-%Y')
                    return datetime.min
                except:
                    return datetime.min
            
            todos_los_pedidos.sort(key=parse_fecha_para_ordenar, reverse=True)
            
            logger.info(f"Pedidos combinados: {len(todos_los_pedidos)} total")
            logger.info(f"  - Antiguos: {len(pedidos_antiguos)}")
            logger.info(f"  - Nuevos convertidos: {len(pedidos_nuevos_convertidos)}")
            
            return todos_los_pedidos
            
        except Exception as e:
            logger.error(f"Error combinando pedidos: {e}")
            return pedidos_antiguos  # Fallback a solo antiguos
    
    def obtener_pedidos_combinados(self) -> List[Dict]:
        """Obtiene pedidos combinados (antiguos + nuevos) con cache"""
        logger.info(f"Cache válido: {self._is_cache_valid()}, Cache disponible: {self.pedidos_antiguos_cache is not None}")
        
        if self._is_cache_valid() and self.pedidos_antiguos_cache is not None:
            logger.info(f"Usando cache de pedidos: {len(self.pedidos_antiguos_cache)} registros")
            return self.pedidos_antiguos_cache
        
        logger.info("Cache no válido o vacío, obteniendo datos frescos...")
        try:
            # Obtener datos de ambas fuentes
            pedidos_antiguos = self.fetch_pedidos_antiguos()
            pedidos_nuevos = self.fetch_pedidos_nuevos()
            
            logger.info(f"Datos obtenidos - Antiguos: {len(pedidos_antiguos)}, Nuevos: {len(pedidos_nuevos)}")
            
            # Combinar y ordenar
            pedidos_combinados = self.combinar_pedidos(pedidos_antiguos, pedidos_nuevos)
            
            logger.info(f"Pedidos combinados: {len(pedidos_combinados)} registros")
            
            # Excluir registros sin usuario NI dirección (cobros administrativos, no despachos reales).
            # Excepción: las ventas del local físico (retirolocal='si') son legítimamente así —
            # un cliente que compra en mostrador no tiene dirección de entrega ni usuario registrado —
            # así que no deben descartarse por este mismo motivo.
            pedidos_combinados = [
                p for p in pedidos_combinados
                if str(p.get('retirolocal', '')).strip().lower() == 'si'
                or not (str(p.get('usuario', '')).strip() == '' and str(p.get('dire', '')).strip() == '')
            ]
            logger.info(f"Pedidos tras filtro de calidad: {len(pedidos_combinados)} registros")

            # Actualizar cache
            self.pedidos_antiguos_cache = pedidos_combinados
            self.cache_timestamp = datetime.now().timestamp()
            
            logger.info("Cache actualizado exitosamente")
            return pedidos_combinados
            
        except Exception as e:
            logger.error(f"Error obteniendo pedidos combinados: {e}")
            # Fallback: usar cache si está disponible
            if self.pedidos_antiguos_cache is not None:
                logger.info("Usando cache como fallback debido a error")
                return self.pedidos_antiguos_cache
            return []

# Instancia global del adaptador
data_adapter = DataAdapter()
