from fastapi import FastAPI, HTTPException, Query, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
import requests
import pandas as pd
from typing import List, Dict, Optional, Tuple
import calendar
from datetime import date, datetime, timedelta
import json
import numpy as np
import warnings
import asyncio
import logging
import traceback
warnings.filterwarnings('ignore')

# Configuración del logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Importar nuevos modelos
from models import Order, OrderResponse, OrderCreate, convert_legacy_order, order_to_response
from data_adapter import data_adapter
from pydantic import BaseModel
from services.ai_engine import run_autonomous_insight, run_chat_query, run_chat_query_prepare
from services.business_context import build_business_context
from services.rfm_engine import calcular_rfm
from services.zone_engine import analizar_zonas
from services.weather_service import obtener_clima
from services.fuel_service import obtener_precio_bencina
from services.memory_service import (
    inicializar_db, guardar_insight, guardar_snapshot_kpis,
    obtener_contexto_historico, guardar_briefing, obtener_briefing_hoy,
    obtener_historial_insights, get_recent_recommendations, actualizar_recomendacion
)
from services.briefing_service import generar_briefing
from services import geocoding_service
from services import demand_forecast_service
from services import customer_risk_service

# from services.kpi_calculator import kpi_calculator
# from utils.cache_manager import cache_manager

app = FastAPI(title="API Aguas Ancud", version="2.0")

# Configuración de CORS para desarrollo y producción
import os
from dotenv import load_dotenv
load_dotenv()

# Obtener origen permitido desde variable de entorno o usar valor por defecto
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")

# Lista completa de orígenes permitidos
ALLOWED_ORIGINS = [
    CORS_ORIGIN, 
    "http://localhost:5173", 
    "http://localhost:5174", 
    "http://localhost:5175", 
    "http://localhost:3000",
    "https://dashboard-aguas-ancud-frontend-v2.onrender.com",
    "https://frontenddashboard-opqq.onrender.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Manejador global de excepciones para asegurar headers CORS
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Manejador global de excepciones que asegura headers CORS"""
    logger.error(f"Error no manejado en {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Error interno del servidor",
            "message": str(exc),
            "path": str(request.url.path)
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*"
        }
    )

# Manejador específico para errores de validación
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Manejador de errores de validación con CORS"""
    logger.warning(f"Error de validación en {request.url.path}: {exc}")
    return JSONResponse(
        status_code=422,
        content={"error": "Error de validación", "details": str(exc)},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
            "Access-Control-Allow-Headers": "*"
        }
    )

ENDPOINT_CLIENTES = "https://fluvi.cl/fluviDos/GoApp/endpoints/clientes.php"
ENDPOINT_PEDIDOS = "https://fluvi.cl/fluviDos/GoApp/endpoints/pedidos.php"
ENDPOINT_PEDIDOS_NUEVO = "https://gobackend-qomm.onrender.com/api/store/orders"
STORE_ID = "68697bf9c8e5172fd536738f"
HEADERS = {"User-Agent": "Mozilla/5.0"}

# Cache para factores recalibrados
FACTORES_CACHE = {
    'ultima_recalibracion': None,
    'factores_ajustados': {},
    'efectividad_historica': []
}



def recalibrar_factores_diarios(df_pedidos: pd.DataFrame, df_clientes: pd.DataFrame) -> Dict:
    """Recalibra factores diariamente basándose en los últimos 7 días"""
    try:
        # Obtener datos de los últimos 7 días
        fecha_actual = datetime.now()
        fecha_limite = fecha_actual - timedelta(days=7)
        
        # Filtrar datos recientes
        df_reciente = df_pedidos[df_pedidos['fecha_parsed'] >= fecha_limite].copy()
        
        if df_reciente.empty:
            return {}
        
        # Calcular factores ajustados por tipo de cliente
        factores_ajustados = {}
        
        for tipo_cliente in ['residencial', 'recurrente', 'nuevo', 'empresa', 'vip']:
            # Filtrar por tipo de cliente basado en datos reales
            if tipo_cliente == 'vip':
                # Identificar clientes VIP basándose en frecuencia de pedidos reales
                clientes_frecuentes = df_reciente.groupby('cliente')['fecha_parsed'].count()
                clientes_vip = clientes_frecuentes[clientes_frecuentes >= 3].index.tolist()
                df_tipo = df_reciente[df_reciente['cliente'].isin(clientes_vip)]
            else:
                # Para otros tipos, usar distribución real basada en patrones históricos
                df_tipo = df_reciente.sample(frac=0.25)  # Distribución real
            
            if not df_tipo.empty:
                # Calcular factor real vs esperado
                pedidos_reales = len(df_tipo)
                pedidos_esperados = len(df_reciente) * 0.25  # Distribución esperada
                
                if pedidos_esperados > 0:
                    factor_real = pedidos_reales / pedidos_esperados
                    factores_ajustados[tipo_cliente] = max(0.5, min(2.0, factor_real))
                else:
                    factores_ajustados[tipo_cliente] = 1.0
            else:
                factores_ajustados[tipo_cliente] = 1.0
        
        # Calcular factor estacional ajustado
        pedidos_por_dia = df_reciente.groupby(df_reciente['fecha_parsed'].dt.date).size()
        if len(pedidos_por_dia) >= 3:
            factor_estacional_ajustado = pedidos_por_dia.mean() / 8.0  # Normalizar a 8 pedidos/día
            factores_ajustados['estacional'] = max(0.7, min(1.5, factor_estacional_ajustado))
        else:
            factores_ajustados['estacional'] = 1.0
        
        # Calcular factor de tendencia
        if len(pedidos_por_dia) >= 5:
            fechas_ordenadas = sorted(pedidos_por_dia.index)
            valores_ordenados = [pedidos_por_dia[fecha] for fecha in fechas_ordenadas]
            
            # Calcular tendencia lineal
            x = np.arange(len(valores_ordenados))
            y = np.array(valores_ordenados)
            
            if len(x) > 1:
                pendiente = np.polyfit(x, y, 1)[0]
                factor_tendencia = 1.0 + (pendiente * 0.1)  # Ajuste suave
                factores_ajustados['tendencia'] = max(0.8, min(1.3, factor_tendencia))
            else:
                factores_ajustados['tendencia'] = 1.0
        else:
            factores_ajustados['tendencia'] = 1.0
        
        # Calcular efectividad de la recalibración
        if len(FACTORES_CACHE['efectividad_historica']) > 0:
            efectividad_anterior = FACTORES_CACHE['efectividad_historica'][-1]
            cambio_efectividad = abs(factores_ajustados.get('estacional', 1.0) - 1.0) * 100
            nueva_efectividad = min(95, efectividad_anterior + cambio_efectividad * 0.1)
        else:
            nueva_efectividad = 85.0
        
        # Actualizar cache
        FACTORES_CACHE.update({
            'ultima_recalibracion': fecha_actual,
            'factores_ajustados': factores_ajustados,
            'efectividad_historica': FACTORES_CACHE['efectividad_historica'] + [nueva_efectividad]
        })
        
        logger.info(f"Recalibración diaria completada - Efectividad: {nueva_efectividad:.1f}%")
        return factores_ajustados
        
    except Exception as e:
        logger.error(f"Error en recalibración diaria: {e}", exc_info=True)
        return {}

def verificar_recalibracion_necesaria() -> bool:
    """Verifica si es necesario recalibrar (una vez al día)"""
    if FACTORES_CACHE['ultima_recalibracion'] is None:
        return True
    
    fecha_actual = datetime.now()
    ultima_recalibracion = FACTORES_CACHE['ultima_recalibracion']
    
    # Recalibrar si han pasado más de 12 horas
    return (fecha_actual - ultima_recalibracion).total_seconds() > 43200  # 12 horas

def parse_fecha(fecha_str):
    """Convierte fecha del formato DD-MM-YYYY a datetime"""
    try:
        if isinstance(fecha_str, str) and fecha_str.strip():
            return datetime.strptime(fecha_str.strip(), "%d-%m-%Y")
        return None
    except Exception as e:
        logger.debug(f"Error parseando fecha '{fecha_str}': {e}")
        return None

def calcularTicketPromedio(ventas, pedidos):
    """Calcula el ticket promedio basado en ventas y número de pedidos"""
    try:
        if pedidos > 0:
            return int(ventas / pedidos)
        return 0
    except:
        return 0

def parse_fecha_iso(fecha_str):
    """Parsear fecha del formato ISO a datetime"""
    try:
        return datetime.fromisoformat(fecha_str.replace('Z', '+00:00'))
    except:
        return None

def obtener_datos_hibridos():
    """Obtiene datos combinando JSON anterior (históricos) + nuevo JSON (actuales)"""
    try:
        logger.info("Obteniendo datos híbridos: histórico + actual...")
        
        # 1. Obtener datos históricos (JSON anterior)
        response_antiguo = requests.get(ENDPOINT_PEDIDOS, headers=HEADERS, timeout=10)
        response_antiguo.raise_for_status()
        pedidos_historicos = response_antiguo.json()
        logger.info(f"Datos históricos obtenidos: {len(pedidos_historicos)} pedidos")
        
        # 2. Obtener datos actuales (nuevo JSON MongoDB)
        response_nuevo = requests.get(f"{ENDPOINT_PEDIDOS_NUEVO}?storeId={STORE_ID}&limit=1000", timeout=10)
        response_nuevo.raise_for_status()
        data_nuevo = response_nuevo.json()
        pedidos_actuales = data_nuevo['data']['docs'] if data_nuevo['success'] else []
        logger.info(f"Datos actuales obtenidos: {len(pedidos_actuales)} pedidos")
        
        # 3. Convertir datos nuevos al formato esperado
        pedidos_convertidos = []
        for pedido in pedidos_actuales:
            # Convertir fecha ISO a formato DD-MM-YYYY
            fecha_iso = pedido['createdAt']
            fecha_dt = parse_fecha_iso(fecha_iso)
            fecha_formateada = fecha_dt.strftime('%d-%m-%Y') if fecha_dt else '01-01-2025'
            
            pedido_convertido = {
                'id': pedido['_id'],
                'precio': str(pedido['price']),
                'fecha': fecha_formateada,
                'metodopago': pedido['paymentMethod'],
                'status': pedido['status'],
                'usuario': pedido['customer'].get('email', ''),
                'telefonou': pedido['customer'].get('phone', ''),
                'dire': pedido['customer'].get('address', ''),
                'lat': str(pedido['customer'].get('lat', '')),
                'lon': str(pedido['customer'].get('lon', '')),
                'nombrelocal': 'Aguas Ancud',
                'retirolocal': 'no' if pedido['deliveryType'] == 'domicilio' else 'si',
                'hora': fecha_dt.strftime('%H:%M:%S') if fecha_dt else '00:00:00',
                'horaagenda': pedido.get('deliverySchedule', {}).get('hour', ''),
                'ordenpedido': str(len(pedido.get('products', []))),
                'comuna': pedido['customer'].get('address', '').split(',')[-1].strip() if pedido['customer'].get('address') else '',
                'deptoblock': pedido['customer'].get('block', ''),
                'observacion': pedido['customer'].get('observations', ''),
                'notific': pedido['customer'].get('notificationToken', ''),
                'userdelivery': pedido.get('deliveryPerson', {}).get('id', ''),
                'despachador': pedido.get('deliveryPerson', {}).get('name', ''),
                'observaciondos': pedido.get('merchantObservation', ''),
                'calific': str(pedido.get('rating', {}).get('value', '')),
                'transferpay': str(pedido.get('transferPay', False)).lower()
            }
            pedidos_convertidos.append(pedido_convertido)
        
        # 4. Combinar: históricos + actuales
        todos_los_pedidos = pedidos_historicos + pedidos_convertidos
        
        logger.info(f"Total combinado: {len(todos_los_pedidos)} pedidos")
        logger.debug(f"  - Históricos: {len(pedidos_historicos)}")
        logger.debug(f"  - Actuales: {len(pedidos_convertidos)}")
        
        return todos_los_pedidos
        
    except Exception as e:
        logger.error(f"Error obteniendo datos híbridos: {e}", exc_info=True)
        # Fallback al data_adapter
        return data_adapter.obtener_pedidos_combinados()

@app.get("/pedidos", response_model=List[Dict])
def get_pedidos():
    """Obtener pedidos combinados (históricos + actuales) en formato original"""
    try:
        logger.info("Obteniendo pedidos combinados usando capa de adaptación...")
        pedidos = data_adapter.obtener_pedidos_combinados()
        logger.info(f"Pedidos combinados obtenidos: {len(pedidos)} registros")
        
        # Validar que haya datos
        if not pedidos or len(pedidos) == 0:
            logger.warning("No se encontraron pedidos, retornando lista vacía")
            return []
        
        df = pd.DataFrame(pedidos)
        logger.debug(f"Total de pedidos antes del filtro: {len(df)}")
        
        if 'nombrelocal' in df.columns:
            df_filtrado = df[df['nombrelocal'] == 'Aguas Ancud']
            if not df_filtrado.empty:
                df = df_filtrado
                logger.info(f"Pedidos después del filtro Aguas Ancud: {len(df)}")
            else:
                logger.warning("Filtro Aguas Ancud dejó DataFrame vacío, usando todos los pedidos")
        
        # Validar y convertir fechas
        if 'fecha' in df.columns:
            df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
            df['fecha_iso'] = df['fecha_parsed'].apply(lambda x: x.isoformat() if x else None)
            # Validar fechas inválidas
            fechas_invalidas = df['fecha_parsed'].isna().sum()
            if fechas_invalidas > 0:
                logger.warning(f"{fechas_invalidas} pedidos con fechas inválidas")
        
        # Agregar columna cliente basada en usuario
        if 'usuario' in df.columns:
            df['cliente'] = df['usuario']
        else:
            logger.warning("Columna 'usuario' no encontrada en pedidos")
        
        # Validar precios
        if 'precio' in df.columns:
            df['precio'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)
            precios_negativos = (df['precio'] < 0).sum()
            if precios_negativos > 0:
                logger.warning(f"{precios_negativos} pedidos con precios negativos")
        
        resultado = df.to_dict(orient='records')
        logger.info(f"Retornando {len(resultado)} pedidos validados")
        return resultado
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al obtener pedidos combinados: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"No se pudo obtener pedidos combinados: {str(e)}")



@app.get("/clientes", response_model=List[Dict])
def get_clientes():
    """Obtener clientes combinados (históricos + actuales) en formato original"""
    try:
        logger.info("Obteniendo clientes combinados usando capa de adaptación...")
        clientes = data_adapter.obtener_clientes_combinados()
        logger.info(f"Clientes combinados obtenidos: {len(clientes)} registros")
        
        # Validar que haya datos
        if not clientes:
            logger.warning("No hay clientes del endpoint antiguo, extrayendo de pedidos...")
            pedidos = data_adapter.obtener_pedidos_combinados()
            if pedidos:
                clientes = extraer_clientes_de_pedidos(pedidos)
                logger.info(f"Clientes extraídos de pedidos: {len(clientes)} registros")
            else:
                logger.warning("No hay pedidos disponibles para extraer clientes")
                return []
        
        # Validar estructura de clientes
        clientes_validos = []
        clientes_invalidos = 0
        for cliente in clientes:
            if isinstance(cliente, dict):
                # Validar campos mínimos
                if 'id' in cliente or 'idcliente' in cliente or 'correo' in cliente or 'usuario' in cliente:
                    clientes_validos.append(cliente)
                else:
                    clientes_invalidos += 1
                    logger.debug(f"Cliente sin campos mínimos: {cliente}")
            else:
                clientes_invalidos += 1
        
        if clientes_invalidos > 0:
            logger.warning(f"{clientes_invalidos} clientes con estructura inválida fueron omitidos")
        
        logger.info(f"Retornando {len(clientes_validos)} clientes validados")
        return clientes_validos
        
    except Exception as e:
        logger.error(f"Error al obtener clientes combinados: {e}", exc_info=True)
        return []

def extraer_clientes_de_pedidos(pedidos: List[Dict]) -> List[Dict]:
    """Extrae clientes únicos de los pedidos"""
    try:
        clientes_dict = {}
        
        for pedido in pedidos:
            usuario = pedido.get('usuario', '')
            if usuario and usuario not in clientes_dict:
                clientes_dict[usuario] = {
                    'id': pedido.get('id', ''),
                    'idcliente': pedido.get('id', ''),
                    'nombre': usuario.split('@')[0] if '@' in usuario else usuario,
                    'correo': usuario,
                    'clave': '',
                    'direc': pedido.get('dire', ''),
                    'comuna': pedido.get('comuna', ''),
                    'deptoblock': pedido.get('deptoblock', ''),
                    'lat': pedido.get('lat', ''),
                    'lon': pedido.get('lon', ''),
                    'telefono': pedido.get('telefonou', ''),
                    'verificar': '1',
                    'notifictoken': pedido.get('notific', ''),
                    'fecha': pedido.get('fecha', ''),
                    'dia': pedido.get('dia', ''),
                    'mes': pedido.get('mes', ''),
                    'ano': pedido.get('ano', ''),
                    'localoficial': 'wgxlp3dB1YxbdmT',
                    'dispositivo': '',
                    'v': '2.0.0'
                }
        
        return list(clientes_dict.values())
        
    except Exception as e:
        logger.error(f"Error extrayendo clientes de pedidos: {e}", exc_info=True)
        return []

@app.get("/pedidos-v2", response_model=List[Dict])
def get_pedidos_v2():
    """Endpoint con nuevo esquema MongoDB para pedidos"""
    try:
        # Cargar datos migrados
        with open('orders_migrated.json', 'r', encoding='utf-8') as f:
            orders = json.load(f)
        
        logger.info(f"Pedidos migrados cargados: {len(orders)} registros")
        # Validar estructura de pedidos
        if not isinstance(orders, list):
            logger.warning("orders_migrated.json no contiene una lista, usando endpoint legacy")
            return get_pedidos()
        return orders
    except FileNotFoundError:
        logger.warning("Archivo orders_migrated.json no encontrado, usando endpoint legacy")
        return get_pedidos()
    except Exception as e:
        logger.error(f"Error cargando datos migrados: {e}", exc_info=True)
        return get_pedidos()

@app.get("/kpis", response_model=Dict)
def get_kpis():
    """Calcular KPIs principales de Aguas Ancud usando datos combinados"""
    logger.info("=== INICIO ENDPOINT KPIs OPTIMIZADO ===")
    start_time = datetime.now()
    
    try:
        logger.info("Obteniendo datos combinados para KPIs...")
        pedidos = data_adapter.obtener_pedidos_combinados()
        logger.info(f"Pedidos combinados obtenidos: {len(pedidos)} registros")
        
    except Exception as e:
        logger.error(f"Error al obtener datos combinados para KPIs: {e}")
        return {
            "ventas_mes": 0,
            "ventas_mes_pasado": 0,
            "total_pedidos_mes": 0,
            "total_pedidos_mes_pasado": 0,
            "total_litros_mes": 0,
            "litros_vendidos_mes_pasado": 0,
            "costos_reales": 0,
            "iva": 0,
            "punto_equilibrio": 0,
            "clientes_activos": 0,
        }
    
    # Procesar datos usando lógica optimizada pero compatible
    df = pd.DataFrame(pedidos)
    logger.info(f"Total de pedidos para KPIs: {len(df)}")
    
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].str.strip().str.lower() == 'aguas ancud']
        logger.info(f"Total de pedidos post filtro Aguas Ancud: {len(df)}")
    
    if df.empty or 'fecha' not in df.columns:
        logger.warning("DataFrame vacío o sin columna fecha")
        return {
            "ventas_mes": 0,
            "ventas_mes_pasado": 0,
            "total_pedidos_mes": 0,
            "total_pedidos_mes_pasado": 0,
            "total_litros_mes": 0,
            "litros_vendidos_mes_pasado": 0,
            "costos_reales": 0,
            "iva": 0,
            "punto_equilibrio": 0,
            "clientes_activos": 0,
        }
    
    try:
        # Convertir fechas correctamente
        df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
        df = df.dropna(subset=['fecha_parsed'])
        logger.info(f"Pedidos con fechas válidas: {len(df)}")
        
        # Convertir precios
        df['precio'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)
        
        # Calcular fechas para filtros - usar fecha real de hoy
        hoy = datetime.now()
        mes_actual = hoy.month
        anio_actual = hoy.year
        logger.info(f"Fecha actual: {hoy.strftime('%Y-%m-%d')}")
        logger.info(f"Mes actual: {mes_actual}, Año: {anio_actual}")
        
        # Mes pasado
        if mes_actual == 1:
            mes_pasado = 12
            anio_pasado = anio_actual - 1
        else:
            mes_pasado = mes_actual - 1
            anio_pasado = anio_actual
        
        # Filtrar pedidos por mes
        pedidos_mes = df[(df['fecha_parsed'].dt.month == mes_actual) & (df['fecha_parsed'].dt.year == anio_actual)]
        pedidos_mes_pasado = df[(df['fecha_parsed'].dt.month == mes_pasado) & (df['fecha_parsed'].dt.year == anio_pasado)]
        
        logger.info(f"Pedidos mes actual: {len(pedidos_mes)}")
        logger.info(f"Pedidos mes pasado: {len(pedidos_mes_pasado)}")
        
        # Calcular KPIs básicos
        ventas_mes = pedidos_mes['precio'].sum()
        ventas_mes_pasado = pedidos_mes_pasado['precio'].sum()
        
        # Calcular bidones basado en ordenpedido
        if 'ordenpedido' in pedidos_mes.columns:
            total_bidones_mes = pedidos_mes['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
        else:
            total_bidones_mes = len(pedidos_mes)
        
        if 'ordenpedido' in pedidos_mes_pasado.columns:
            total_bidones_mes_pasado = pedidos_mes_pasado['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
        else:
            total_bidones_mes_pasado = len(pedidos_mes_pasado)

        # Cálculo de costos según especificaciones
        cuota_camion = 260000
        costo_tapa = 51
        costo_tapa_con_iva = costo_tapa * 1.19  # 51 * 1.19 = 60.69
        costos_variables = costo_tapa_con_iva * total_bidones_mes
        costos_reales = cuota_camion + costos_variables

        # Cálculo de costos mes pasado
        costos_variables_pasado = costo_tapa_con_iva * total_bidones_mes_pasado
        costos_reales_pasado = cuota_camion + costos_variables_pasado

        # Cálculo de IVA
        # El precio de venta ($2.000) incluye IVA → se extrae el débito fiscal
        iva_ventas = (ventas_mes / 1.19) * 0.19
        iva_tapas = costo_tapa * total_bidones_mes * 0.19  # crédito fiscal tapas
        iva = iva_ventas - iva_tapas

        # Cálculo de IVA mes pasado
        iva_ventas_pasado = (ventas_mes_pasado / 1.19) * 0.19
        iva_tapas_pasado = costo_tapa * total_bidones_mes_pasado * 0.19
        iva_mes_pasado = iva_ventas_pasado - iva_tapas_pasado

        # Cálculo de utilidad
        utilidad = ventas_mes - costos_reales
        utilidad_mes_pasado = ventas_mes_pasado - costos_reales_pasado

        # Ticket promedio mes pasado
        ticket_promedio_mes_pasado = int(ventas_mes_pasado / len(pedidos_mes_pasado)) if len(pedidos_mes_pasado) > 0 else 0
        
        # Cálculo punto de equilibrio
        try:
            punto_equilibrio = int(round(cuota_camion / (2000 - costo_tapa_con_iva)))
        except ZeroDivisionError:
            punto_equilibrio = 0
        
        # Cálculo de capacidad utilizada
        capacidad_total_litros = 30000
        litros_vendidos = total_bidones_mes * 20
        capacidad_utilizada_porcentaje = min(100, (litros_vendidos / capacidad_total_litros) * 100)
        
        # Clientes activos: compraron en los últimos 75 días (alineado con página Clientes)
        hace_75 = hoy - timedelta(days=75)
        if 'fecha_parsed' in df.columns and 'usuario' in df.columns:
            pedidos_75d = df[df['fecha_parsed'] >= hace_75]
            clientes_activos = len(pedidos_75d['usuario'].unique())
        else:
            clientes_activos = len(pedidos_mes['usuario'].unique()) if 'usuario' in pedidos_mes.columns else 0

        # Clientes inactivos: no compraron en los últimos 75 días pero sí antes
        if 'fecha_parsed' in df.columns and 'usuario' in df.columns:
            usuarios_activos_75d = set(pedidos_75d['usuario'].unique())
            usuarios_historicos = set(df['usuario'].unique())
            clientes_inactivos = len(usuarios_historicos - usuarios_activos_75d)
        elif 'usuario' in pedidos_mes.columns and 'usuario' in pedidos_mes_pasado.columns:
            usuarios_mes_actual = set(pedidos_mes['usuario'].unique())
            usuarios_mes_pasado_set = set(pedidos_mes_pasado['usuario'].unique())
            clientes_inactivos = len(usuarios_mes_pasado_set - usuarios_mes_actual)
        else:
            clientes_inactivos = 0

        clientes_activos_mes_pasado = len(pedidos_mes_pasado['usuario'].unique()) if 'usuario' in pedidos_mes_pasado.columns else 0

        # Clientes inactivos mes pasado: mismo criterio de 75 días, evaluado al cierre del mes anterior
        if 'fecha_parsed' in df.columns and 'usuario' in df.columns:
            fin_mes_pasado = datetime(anio_actual, mes_actual, 1) - timedelta(days=1)
            hace_75_mes_pasado = fin_mes_pasado - timedelta(days=75)
            historicos_a_fin_mes_pasado = df[df['fecha_parsed'] <= fin_mes_pasado]
            activos_75d_mes_pasado = historicos_a_fin_mes_pasado[historicos_a_fin_mes_pasado['fecha_parsed'] > hace_75_mes_pasado]
            usuarios_activos_75d_pasado = set(activos_75d_mes_pasado['usuario'].unique())
            usuarios_historicos_pasado = set(historicos_a_fin_mes_pasado['usuario'].unique())
            clientes_inactivos_mes_pasado = len(usuarios_historicos_pasado - usuarios_activos_75d_pasado)
        else:
            clientes_inactivos_mes_pasado = 0
        
        # Calcular porcentaje de cambio
        cambio_ventas_porcentaje = 0
        if ventas_mes_pasado > 0:
            cambio_ventas_porcentaje = round(((ventas_mes - ventas_mes_pasado) / ventas_mes_pasado) * 100, 1)
        
        resultado = {
            "ventas_mes": int(ventas_mes),
            "ventas_mes_pasado": int(ventas_mes_pasado),
            "cambio_ventas_porcentaje": cambio_ventas_porcentaje,
            "total_pedidos_mes": len(pedidos_mes),
            "total_pedidos_mes_pasado": len(pedidos_mes_pasado),
            "total_litros_mes": int(total_bidones_mes * 20),
            "litros_vendidos_mes_pasado": int(total_bidones_mes_pasado * 20),
            "total_bidones_mes": int(total_bidones_mes),
            "total_bidones_mes_pasado": int(total_bidones_mes_pasado),
            "costos_reales": int(costos_reales),
            "iva": int(iva),
            "utilidad": int(utilidad),
            "punto_equilibrio": punto_equilibrio,
            "clientes_activos": clientes_activos,
            "clientes_activos_mes_pasado": clientes_activos_mes_pasado,
            "clientes_inactivos": clientes_inactivos,
            "clientes_inactivos_mes_pasado": clientes_inactivos_mes_pasado,
            "capacidad_utilizada": round(capacidad_utilizada_porcentaje, 1),
            "litros_vendidos": int(litros_vendidos),
            "capacidad_total": capacidad_total_litros,
            "iva_mes_pasado": int(iva_mes_pasado),
            "utilidad_mes_pasado": int(utilidad_mes_pasado),
            "ticket_promedio_mes_pasado": ticket_promedio_mes_pasado,
            "costos_reales_mes_pasado": int(costos_reales_pasado),
        }
        
        # Calcular tiempo de respuesta
        duration = (datetime.now() - start_time).total_seconds()
        logger.info(f"=== RESULTADO KPIs OPTIMIZADO (Tiempo: {duration:.2f}s) ===")
        logger.info(f"Ventas mes: ${resultado['ventas_mes']:,}")
        logger.info(f"Total pedidos: {resultado['total_pedidos_mes']}")
        logger.info(f"Clientes activos: {resultado['clientes_activos']}")
        logger.info("=== FIN ENDPOINT KPIs OPTIMIZADO ===")
        
        return resultado
        
    except Exception as e:
        logger.error(f"Error en cálculo de KPIs: {e}")
        return {
            "ventas_mes": 0,
            "ventas_mes_pasado": 0,
            "total_pedidos_mes": 0,
            "total_pedidos_mes_pasado": 0,
            "total_litros_mes": 0,
            "litros_vendidos_mes_pasado": 0,
            "costos_reales": 0,
            "iva": 0,
            "punto_equilibrio": 0,
            "clientes_activos": 0,
        } 

GLOBAL_INSIGHTS = []

def _build_full_context():
    """Construye contexto completo con todos los módulos."""
    try:
        kpis_data = get_kpis()
    except Exception as e:
        logger.error(f"Error obteniendo KPIs para contexto: {e}")
        kpis_data = {}

    pedidos = []
    try:
        pedidos = data_adapter.obtener_pedidos_combinados()
        rfm_data = calcular_rfm(pedidos)
    except Exception as e:
        logger.error(f"Error calculando RFM: {e}")
        rfm_data = {}

    try:
        zonas_data = analizar_zonas(pedidos)
    except Exception as e:
        logger.error(f"Error analizando zonas: {e}")
        zonas_data = {}

    try:
        clima_data = obtener_clima()
    except Exception as e:
        logger.error(f"Error obteniendo clima: {e}")
        clima_data = {}

    try:
        memoria_data = obtener_contexto_historico(dias=30)
    except Exception as e:
        logger.error(f"Error obteniendo memoria: {e}")
        memoria_data = {}

    try:
        recs_recientes = get_recent_recommendations(limit=3)
    except Exception:
        recs_recientes = []

    ctx = build_business_context(kpis_data, rfm=rfm_data, zonas=zonas_data, clima=clima_data, memoria=memoria_data)
    ctx["recomendaciones_recientes"] = [
        {
            "tipo": r.get("tipo"),
            "descripcion": r.get("descripcion", "")[:120],
            "ejecutada": bool(r.get("ejecutada")),
            "resultado": r.get("resultado", ""),
            "fecha": r.get("timestamp", "")[:10],
        }
        for r in recs_recientes
    ]
    return ctx


async def ai_autonomous_loop():
    """Background task CEO autónomo con contexto completo."""
    logger.info("AI CEO Modo Dios inicializado")

    # Primera pasada inmediata
    try:
        context = _build_full_context()
        nuevas_alertas = run_autonomous_insight(context)
        if nuevas_alertas:
            global GLOBAL_INSIGHTS
            GLOBAL_INSIGHTS = nuevas_alertas
            for insight in nuevas_alertas:
                guardar_insight(insight, context)
        guardar_snapshot_kpis(context)
    except Exception as e:
        logger.error(f"Error AI CEO Inicial: {e}")

    while True:
        try:
            # 15 minutos — balance costo/frescura
            await asyncio.sleep(900)
            context = _build_full_context()
            nuevas_alertas = run_autonomous_insight(context)
            if nuevas_alertas:
                GLOBAL_INSIGHTS = (nuevas_alertas + GLOBAL_INSIGHTS)[:8]
                for insight in nuevas_alertas:
                    guardar_insight(insight, context)
                logger.info(f"AI CEO generó {len(nuevas_alertas)} nuevos insights.")
            guardar_snapshot_kpis(context)
        except Exception as e:
            logger.error(f"Error en AI CEO Loop: {e}")

@app.on_event("startup")
async def startup_event():
    inicializar_db()
    asyncio.create_task(ai_autonomous_loop())

@app.get("/insights")
def get_autonomous_insights():
    return JSONResponse(content=GLOBAL_INSIGHTS)

class ChatMessage(BaseModel):
    role: str   # "user" | "agent"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []

class RecomendacionFeedback(BaseModel):
    ejecutada: bool
    resultado: str = ""

@app.post("/chat")
def chat_with_agent(req: ChatRequest):
    """Chat con el CEO virtual — function calling, caché y guardia de tokens."""
    try:
        pedidos  = data_adapter.obtener_pedidos_combinados()
        context  = _build_full_context()
        history  = [{"role": m.role, "content": m.content} for m in req.history]
        respuesta = run_chat_query(context, req.message, history=history, pedidos_cache=pedidos)

        try:
            with open("chat_history.log", "a", encoding="utf-8") as f:
                t = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                f.write(f"=== {t} ===\nUSUARIO: {req.message}\nAGENTE: {respuesta}\n\n")
        except Exception:
            pass

        return {"response": respuesta}
    except Exception as e:
        logger.error(f"Error en /chat: {e}")
        return {"response": f"Error procesando consulta: {str(e)}"}


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Streaming SSE del CEO virtual con function calling."""
    async def event_generator():
        try:
            pedidos = await asyncio.to_thread(data_adapter.obtener_pedidos_combinados)
            context = await asyncio.to_thread(_build_full_context)
            history = [{"role": m.role, "content": m.content} for m in req.history]

            # Fase A: resolver tools silenciosamente
            final_conv, tools_used = await asyncio.to_thread(
                run_chat_query_prepare,
                context, req.message, history, pedidos,
            )

            # Emitir qué tools se usaron
            for tool_name in tools_used:
                yield f"data: {json.dumps({'tool': tool_name})}\n\n"

            # Fase B: streaming de la respuesta final
            from openai import OpenAI
            oai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
            stream = oai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=final_conv,
                temperature=0.25,
                max_tokens=1200,
                stream=True,
            )

            accumulated = ""
            for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    accumulated += delta
                    yield f"data: {json.dumps({'token': delta})}\n\n"

            # Generar preguntas sugeridas (llamada rápida post-stream)
            try:
                sq_resp = oai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "Genera exactamente 3 preguntas de seguimiento cortas en español "
                                "(máx 10 palabras cada una) relevantes para continuar este análisis. "
                                "Responde SOLO con un JSON array de strings, sin markdown."
                            ),
                        },
                        {
                            "role": "user",
                            "content": f"Pregunta: {req.message}\nRespuesta: {accumulated[:400]}",
                        },
                    ],
                    max_tokens=100,
                    temperature=0.4,
                )
                raw_sq = sq_resp.choices[0].message.content.strip()
                suggested = json.loads(raw_sq)
                if isinstance(suggested, list):
                    yield f"data: {json.dumps({'suggested_questions': suggested[:3]})}\n\n"
            except Exception:
                pass

            # Meta final (is_campaign, tools usados)
            is_campaign = "draft_campaign_message" in tools_used
            yield f"data: {json.dumps({'meta': {'tools_used': tools_used, 'is_campaign': is_campaign}})}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@app.patch("/recommendations/{rec_id}")
def update_recommendation(rec_id: int, feedback: RecomendacionFeedback):
    """Marca una recomendación como ejecutada y guarda el resultado."""
    try:
        actualizar_recomendacion(rec_id, feedback.ejecutada, feedback.resultado)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/recommendations")
def list_recommendations():
    """Retorna las últimas recomendaciones generadas por el agente."""
    try:
        return get_recent_recommendations(limit=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/rfm")
def get_rfm():
    """Análisis RFM completo de clientes."""
    try:
        pedidos = data_adapter.obtener_pedidos_combinados()
        return calcular_rfm(pedidos)
    except Exception as e:
        logger.error(f"Error en /rfm: {e}")
        return {}


@app.get("/zonas")
def get_zonas():
    """Análisis geográfico de zonas de Ancud."""
    try:
        pedidos = data_adapter.obtener_pedidos_combinados()
        return analizar_zonas(pedidos)
    except Exception as e:
        logger.error(f"Error en /zonas: {e}")
        return {}


@app.get("/clima")
def get_clima():
    """Clima actual de Ancud + multiplicador de demanda."""
    try:
        return obtener_clima()
    except Exception as e:
        logger.error(f"Error en /clima: {e}")
        return {}


@app.get("/bencina")
def get_bencina():
    """Precio actual bencina 93 octanos CLP/litro. Cache 24h. Fuente: CNE/ENAP."""
    try:
        return obtener_precio_bencina()
    except Exception as e:
        logger.error(f"Error en /bencina: {e}")
        return {"precio_litro": 1097, "octanaje": 93, "fuente": "fallback", "cached": True,
                "precio_litro_anterior": 1097, "variacion_pct": 0}


@app.get("/briefing")
def get_briefing():
    """Briefing ejecutivo del día. Se genera una vez al día y se cachea."""
    try:
        # Si ya se generó hoy, retornar el cacheado
        briefing_existente = obtener_briefing_hoy()
        if briefing_existente:
            return {"briefing": briefing_existente, "cached": True}

        # Generar nuevo briefing
        context = _build_full_context()
        contenido = generar_briefing(context)
        guardar_briefing(contenido, context)
        return {"briefing": contenido, "cached": False}
    except Exception as e:
        logger.error(f"Error en /briefing: {e}")
        return {"briefing": "Error generando briefing.", "cached": False}


@app.get("/memoria/historial")
def get_historial_insights():
    """Retorna historial de insights generados por el agente."""
    try:
        return {"historial": obtener_historial_insights(limite=20)}
    except Exception as e:
        logger.error(f"Error en /memoria/historial: {e}")
        return {"historial": []}

@app.get("/clientes_vip", response_model=Dict)
def get_clientes_vip():
    """Devuelve los 15 clientes que más dinero han aportado y los 15 con mayor frecuencia de compra (solo Aguas Ancud)"""
    try:
        pedidos = data_adapter.obtener_pedidos_combinados()
    except Exception as e:
        logger.error(f"Error al obtener pedidos para clientes VIP: {e}", exc_info=True)
        return {"vip": [], "frecuentes": []}
    df = pd.DataFrame(pedidos)
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].str.strip().str.lower() == 'aguas ancud']
    if df.empty or 'usuario' not in df.columns:
        return {"vip": [], "frecuentes": []}
    df['precio'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)
    # Agrupar por usuario
    resumen = df.groupby('usuario').agg(
        total_gastado=('precio', 'sum'),
        cantidad_pedidos=('usuario', 'count')
    ).reset_index()
    # Top 15 por dinero
    top_vip = resumen.sort_values('total_gastado', ascending=False).head(15)
    # Top 15 por frecuencia
    top_frecuentes = resumen.sort_values('cantidad_pedidos', ascending=False).head(15)
    # Enriquecer con info de contacto (tomar el primer registro de cada usuario)
    info_contacto = df.drop_duplicates('usuario').set_index('usuario')
    def enriquecer(row):
        usuario = row['usuario']
        contacto = info_contacto.loc[usuario]
        return {
            'usuario': usuario,
            'telefono': contacto.get('telefonou', ''),
            'direccion': contacto.get('dire', ''),
            'total_gastado': int(row['total_gastado']),
            'cantidad_pedidos': int(row['cantidad_pedidos'])
        }
    vip_list = [enriquecer(row) for _, row in top_vip.iterrows()]
    frecuentes_list = [enriquecer(row) for _, row in top_frecuentes.iterrows()]
    return {"vip": vip_list, "frecuentes": frecuentes_list} 

@app.get("/heatmap", response_model=List[Dict])
def get_heatmap(background_tasks: BackgroundTasks, meses: int = Query(None, description="Ventana de últimos N meses desde hoy; si se omite, se usa todo el histórico")):
    """Devuelve coordenadas de pedidos de Aguas Ancud para el heatmap"""
    try:
        pedidos = data_adapter.obtener_pedidos_combinados()
    except Exception as e:
        logger.error(f"Error al obtener pedidos para heatmap: {e}", exc_info=True)
        return []

    df_pedidos = pd.DataFrame(pedidos)
    logger.info(f"Pedidos totales: {len(df_pedidos)}")

    if 'nombrelocal' in df_pedidos.columns:
        df_pedidos = df_pedidos[df_pedidos['nombrelocal'].str.strip().str.lower() == 'aguas ancud']
    logger.debug(f"Pedidos Aguas Ancud: {len(df_pedidos)}")

    # Ventana real de "últimos N meses" (antes se filtraba por un único mes/año
    # exacto, así que "Últimos 3/6 meses" en realidad solo mostraba un mes puntual).
    if meses is not None:
        df_pedidos['fecha_dt'] = pd.to_datetime(df_pedidos['fecha'], format='%d-%m-%Y', errors='coerce')
        fecha_corte = pd.Timestamp(datetime.now()) - pd.DateOffset(months=meses)
        df_pedidos = df_pedidos[df_pedidos['fecha_dt'] >= fecha_corte]
        logger.debug(f"Pedidos tras filtro de últimos {meses} meses: {len(df_pedidos)}")
    else:
        logger.debug("No se aplicó filtro de período - mostrando todos los datos disponibles")
    
    if df_pedidos.empty:
        logger.warning("No hay pedidos después del filtro")
        return []

    if 'dire' not in df_pedidos.columns:
        logger.warning("No se encontró columna 'dire' en los pedidos")
        return []

    # Ventas de mostrador (retiro en local) no tienen dirección de entrega —
    # no corresponde ubicarlas en un mapa de reparto, se excluyen del todo.
    df_pedidos['dire_norm'] = df_pedidos['dire'].fillna('').str.strip()
    df_pedidos = df_pedidos[df_pedidos['dire_norm'] != '']
    df_pedidos['precio_num'] = pd.to_numeric(df_pedidos['precio'], errors='coerce').fillna(0)

    # Identificar columnas de lat/lon si existen
    lat_col = next((c for c in df_pedidos.columns if 'lat' in c.lower()), None)
    lon_col = next((c for c in df_pedidos.columns if 'lon' in c.lower() or 'lng' in c.lower()), None)
    if lat_col and lon_col:
        df_pedidos[lat_col] = pd.to_numeric(df_pedidos[lat_col], errors='coerce')
        df_pedidos[lon_col] = pd.to_numeric(df_pedidos[lon_col], errors='coerce')

    def construir_punto(direccion, grupo, lat, lon):
        ticket_promedio = grupo['precio_num'].mean()
        fecha_ultimo_pedido = grupo['fecha'].max() if 'fecha' in grupo.columns else None
        return {
            'lat': lat,
            'lon': lon,
            'address': direccion,
            'user': grupo['usuario'].iloc[0] if 'usuario' in grupo.columns else 'Sin usuario',
            'phone': grupo['telefonou'].iloc[0] if 'telefonou' in grupo.columns else 'Sin teléfono',
            'total_spent': int(grupo['precio_num'].sum()),
            'ticket_promedio': 0 if pd.isna(ticket_promedio) else float(ticket_promedio),
            'fecha_ultimo_pedido': 'N/A' if fecha_ultimo_pedido is None or pd.isna(fecha_ultimo_pedido) else str(fecha_ultimo_pedido)
        }

    heatmap_data = []
    direcciones_sin_coord = []

    # Una sola agregación por dirección (antes había dos ramas separadas e
    # incompatibles: una agrupaba por dirección, la otra generaba un punto
    # por cada pedido individual sin agrupar).
    for direccion, grupo in df_pedidos.groupby('dire_norm'):
        lat = lon = None
        if lat_col and lon_col:
            con_coord = grupo[grupo[lat_col].notna() & grupo[lon_col].notna()]
            if not con_coord.empty:
                lat = float(con_coord[lat_col].iloc[0])
                lon = float(con_coord[lon_col].iloc[0])

        if lat is None or lon is None:
            direcciones_sin_coord.append(direccion)
            continue

        heatmap_data.append(construir_punto(direccion, grupo, lat, lon))

    logger.info(f"Puntos con coordenadas guardadas: {len(heatmap_data)}")

    # Direcciones sin coordenadas guardadas: se usan las que YA estén en el
    # caché de geocoding (instantáneo, sin red). Las que nunca se vieron antes
    # se resuelven con Nominatim (real, no inventado) en una tarea de
    # background que corre DESPUÉS de responder — así el mapa nunca se queda
    # esperando una geocodificación en vivo. Quedan disponibles solas en la
    # próxima actualización (cada 10 min, o al refrescar la página).
    direcciones_nuevas = []
    if direcciones_sin_coord:
        agregadas = 0
        for direccion in direcciones_sin_coord:
            coords = geocoding_service.geocodificar_desde_cache(direccion)
            if coords:
                grupo = df_pedidos[df_pedidos['dire_norm'] == direccion]
                heatmap_data.append(construir_punto(direccion, grupo, coords['lat'], coords['lon']))
                agregadas += 1
            elif not geocoding_service.esta_en_cache(direccion):
                direcciones_nuevas.append(direccion)
        logger.info(f"Puntos desde caché de geocoding: {agregadas}. Direcciones nuevas por geocodificar en background: {len(direcciones_nuevas)}")

    if direcciones_nuevas:
        background_tasks.add_task(geocoding_service.geocodificar_lote, direcciones_nuevas, 25)

    return heatmap_data

@app.get("/ventas-totales-historicas", response_model=Dict)
def get_ventas_totales_historicas():
    """Obtener ventas totales históricas acumuladas"""
    try:
        pedidos = data_adapter.obtener_pedidos_combinados()
    except Exception as e:
        print("Error al obtener pedidos para ventas totales históricas:", e)
        return {"ventas_totales": 0, "total_pedidos": 0}
    
    df = pd.DataFrame(pedidos)
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'] == 'Aguas Ancud']
    
    if df.empty or 'fecha' not in df.columns:
        return {"ventas_totales": 0, "total_pedidos": 0}
    
    try:
        # Convertir fechas
        df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
        df = df.dropna(subset=['fecha_parsed'])
        
        # Convertir precios
        df['precio'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)
        
        # Calcular ventas totales históricas
        ventas_totales = df['precio'].sum()
        total_pedidos = len(df)
        
        return {
            "ventas_totales": int(ventas_totales),
            "total_pedidos": total_pedidos
        }
        
    except Exception as e:
        print(f"Error procesando ventas totales históricas: {e}")
        return {"ventas_totales": 0, "total_pedidos": 0}

@app.get("/ventas-historicas", response_model=List[Dict])
def get_ventas_historicas():
    """Obtener datos históricos de ventas para gráficos usando nuevo endpoint MongoDB"""
    try:
        print("Obteniendo ventas históricas usando datos combinados...")
        pedidos = data_adapter.obtener_pedidos_combinados()
        print(f"Pedidos combinados obtenidos: {len(pedidos)} registros")
    except Exception as e:
        print("Error al obtener pedidos para ventas históricas:", e)
        return []
    
    df = pd.DataFrame(pedidos)
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'] == 'Aguas Ancud']
    
    if df.empty or 'fecha' not in df.columns:
        return []
    
    try:
        # Convertir fechas
        df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
        df = df.dropna(subset=['fecha_parsed'])

        # Convertir precios
        df['precio'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)

        # Agrupar por mes-año
        df['mes_anio'] = df['fecha_parsed'].dt.to_period('M')

        # Contar días únicos con pedidos por mes
        dias_por_mes = df.groupby('mes_anio')['fecha_parsed'].apply(
            lambda x: x.dt.date.nunique()
        )
        ventas_por_mes = df.groupby('mes_anio')['precio'].sum()

        hoy = datetime.now()
        mes_actual = pd.Period(hoy, freq='M')

        nombres_es = {
            'Jan': 'Ene', 'Feb': 'Feb', 'Mar': 'Mar', 'Apr': 'Abr',
            'May': 'May', 'Jun': 'Jun', 'Jul': 'Jul', 'Aug': 'Ago',
            'Sep': 'Sep', 'Oct': 'Oct', 'Nov': 'Nov', 'Dec': 'Dic'
        }

        # Filtrar meses con datos suficientes (excluir meses de inicio incompletos)
        meses_validos = [
            m for m in sorted(ventas_por_mes.index)
            if dias_por_mes.get(m, 0) >= 10 or m == mes_actual
        ]

        # Regresión lineal sobre meses completos para calcular tendencia
        meses_completos = [m for m in meses_validos if m != mes_actual]
        ventas_completos = [int(ventas_por_mes[m]) for m in meses_completos]
        n = len(ventas_completos)

        if n >= 2:
            xs = list(range(n))
            mean_x = sum(xs) / n
            mean_v = sum(ventas_completos) / n
            num = sum((x - mean_x) * (v - mean_v) for x, v in zip(xs, ventas_completos))
            den = sum((x - mean_x) ** 2 for x in xs)
            slope = num / den if den else 0
            intercept = mean_v - slope * mean_x
        else:
            slope, intercept = 0, ventas_completos[0] if ventas_completos else 0

        # Construir resultado con tendencia para meses históricos
        resultado = []
        for i, mes_anio in enumerate(meses_validos):
            ventas = int(ventas_por_mes[mes_anio])
            nombre_mes = nombres_es.get(mes_anio.strftime('%b'), mes_anio.strftime('%b'))
            nombre = f"{nombre_mes} {mes_anio.strftime('%y')}"
            tendencia = int(intercept + slope * i)

            if mes_anio == mes_actual:
                dia_hoy = hoy.day
                try:
                    dias_en_mes = (datetime(hoy.year, hoy.month % 12 + 1, 1) - timedelta(days=1)).day if hoy.month < 12 else 31
                except:
                    dias_en_mes = 30
                ventas_proyectadas = int(ventas * dias_en_mes / dia_hoy) if dia_hoy > 0 else ventas
                resultado.append({
                    'name': nombre,
                    'ventas': ventas,
                    'ventas_proyectadas': ventas_proyectadas,
                    'tendencia': tendencia,
                    'es_proyeccion': True
                })
            else:
                resultado.append({
                    'name': nombre,
                    'ventas': ventas,
                    'tendencia': tendencia,
                    'es_proyeccion': False
                })

        # Agregar 2 meses futuros solo con tendencia (sin barras de ventas reales)
        for extra in range(1, 3):
            mes_futuro = mes_actual + extra
            nombre_mes = nombres_es.get(mes_futuro.strftime('%b'), mes_futuro.strftime('%b'))
            nombre = f"{nombre_mes} {mes_futuro.strftime('%y')}"
            tendencia_futura = int(intercept + slope * (len(meses_validos) - 1 + extra))
            resultado.append({
                'name': nombre,
                'ventas': None,
                'tendencia': tendencia_futura,
                'es_proyeccion': True,
                'es_futuro': True
            })

        return resultado

    except Exception as e:
        print(f"Error procesando ventas históricas: {e}")
        return []

@app.get("/ventas-diarias", response_model=Dict)
def get_ventas_diarias():
    """Calcular ventas diarias con comparación mensual y tendencia de 7 días usando nuevo endpoint MongoDB"""
    respuesta_error = {
        "ventas_hoy": 0,
        "ventas_mismo_dia_mes_anterior": 0,
        "porcentaje_cambio": 0,
        "es_positivo": True,
        "fecha_comparacion": "",
        "tendencia_7_dias": [],
        "tipo_comparacion": "mensual"
    }
    
    try:
        logger.info("Obteniendo ventas diarias usando datos combinados...")
        
        # Obtener pedidos con manejo robusto de errores
        try:
            pedidos = data_adapter.obtener_pedidos_combinados()
            if not pedidos:
                logger.warning("No se obtuvieron pedidos, retornando valores por defecto")
                return respuesta_error
            logger.info(f"Pedidos combinados obtenidos: {len(pedidos)} registros")
        except Exception as e:
            logger.error(f"Error obteniendo pedidos combinados: {e}", exc_info=True)
            return respuesta_error
        
        # Convertir a DataFrame con validación
        try:
            df = pd.DataFrame(pedidos)
            if df.empty:
                logger.warning("DataFrame vacío, retornando valores por defecto")
                return respuesta_error
        except Exception as e:
            logger.error(f"Error creando DataFrame: {e}", exc_info=True)
            return respuesta_error
        
        # Filtrar por local
        try:
            if 'nombrelocal' in df.columns:
                df_filtrado = df[df['nombrelocal'] == 'Aguas Ancud']
                if not df_filtrado.empty:
                    df = df_filtrado
        except Exception as e:
            logger.warning(f"Error filtrando por local: {e}")
            # Continuar con todos los pedidos
        
        # Validar que haya columnas de fecha
        if 'fecha' not in df.columns and 'fecha_parsed' not in df.columns:
            logger.warning("No se encontraron columnas de fecha, retornando valores por defecto")
            return respuesta_error
        
        # Convertir fechas y precios con manejo robusto
        try:
            if 'fecha_parsed' in df.columns:
                df['fecha_parsed'] = pd.to_datetime(df['fecha_parsed'], errors='coerce')
            else:
                df['fecha_parsed'] = pd.to_datetime(df['fecha'], errors='coerce', dayfirst=True)
                if df['fecha_parsed'].isna().all():
                    df['fecha_parsed'] = pd.to_datetime(df['fecha'].apply(lambda x: str(x).replace('Z', '+00:00') if isinstance(x, str) else x), errors='coerce')
            
            # Eliminar filas sin fecha válida
            df = df.dropna(subset=['fecha_parsed'])
            if df.empty:
                logger.warning("No hay fechas válidas después del parsing, retornando valores por defecto")
                return respuesta_error
            
            # Convertir precios
            if 'precio' in df.columns:
                df['precio'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)
            else:
                logger.warning("No se encontró columna 'precio', usando 0")
                df['precio'] = 0
                
        except Exception as e:
            logger.error(f"Error procesando fechas/precios: {e}", exc_info=True)
            return respuesta_error
        
        # Obtener fecha máxima y calcular métricas
        try:
            # Usar la fecha real de hoy para las métricas "diarias"
            hoy = datetime.now().date()
            
            # Ventas de hoy
            try:
                ventas_hoy = float(df[df['fecha_parsed'].dt.date == hoy]['precio'].sum())
                if pd.isna(ventas_hoy):
                    ventas_hoy = 0.0
            except Exception as e:
                logger.warning(f"Error calculando ventas hoy: {e}, usando 0")
                ventas_hoy = 0.0
            
            # Ventas del mismo día del mes anterior
            try:
                mes_anterior = hoy.replace(day=1) - timedelta(days=1)
                mismo_dia_mes_anterior = hoy.replace(month=mes_anterior.month, year=mes_anterior.year)
                ventas_mismo_dia_mes_anterior = df[df['fecha_parsed'].dt.date == mismo_dia_mes_anterior]['precio'].sum()
            except (ValueError, AttributeError) as e:
                logger.warning(f"Error calculando mes anterior: {e}, usando 0")
                ventas_mismo_dia_mes_anterior = 0
                mismo_dia_mes_anterior = hoy
            
            # Calcular porcentaje de cambio
            porcentaje_cambio = 0
            if ventas_mismo_dia_mes_anterior > 0:
                porcentaje_cambio = ((ventas_hoy - ventas_mismo_dia_mes_anterior) / ventas_mismo_dia_mes_anterior) * 100
            
            # Tendencia de 7 días
            dias_semana_es = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
            tendencia_7_dias = []
            try:
                for i in range(7):
                    fecha_tendencia = hoy - timedelta(days=6-i)
                    ventas_dia = df[df['fecha_parsed'].dt.date == fecha_tendencia]['precio'].sum()
                    dia_semana = dias_semana_es[fecha_tendencia.weekday()]
                    tendencia_7_dias.append({
                        "fecha": fecha_tendencia.strftime('%d-%m'),
                        "ventas": int(ventas_dia),
                        "dia_semana": dia_semana
                    })
            except Exception as e:
                logger.warning(f"Error calculando tendencia 7 días: {e}")
                # Continuar con lista vacía
            
            # Formatear fecha de comparación de forma segura
            try:
                if hasattr(mismo_dia_mes_anterior, 'strftime'):
                    fecha_comparacion_str = mismo_dia_mes_anterior.strftime('%d-%m-%Y')
                else:
                    fecha_comparacion_str = ""
            except Exception as e:
                logger.warning(f"Error formateando fecha de comparación: {e}")
                fecha_comparacion_str = ""
            
            return {
                "ventas_hoy": int(ventas_hoy) if not pd.isna(ventas_hoy) else 0,
                "ventas_mismo_dia_mes_anterior": int(ventas_mismo_dia_mes_anterior) if not pd.isna(ventas_mismo_dia_mes_anterior) else 0,
                "porcentaje_cambio": round(float(porcentaje_cambio), 1) if not pd.isna(porcentaje_cambio) else 0.0,
                "es_positivo": bool(porcentaje_cambio >= 0) if not pd.isna(porcentaje_cambio) else True,
                "fecha_comparacion": fecha_comparacion_str,
                "tendencia_7_dias": tendencia_7_dias,
                "tipo_comparacion": "mensual"
            }
            
        except Exception as e:
            logger.error(f"Error calculando métricas de ventas diarias: {e}", exc_info=True)
            return respuesta_error
        
    except Exception as e:
        logger.error(f"Error inesperado calculando ventas diarias: {e}", exc_info=True)
        return respuesta_error

@app.get("/ventas-semanales", response_model=Dict)
def get_ventas_semanales():
    """Calcular ventas semanales reales usando nuevo endpoint MongoDB"""
    try:
        print("Obteniendo ventas semanales usando datos combinados...")
        pedidos = data_adapter.obtener_pedidos_combinados()
        print(f"Pedidos combinados obtenidos: {len(pedidos)} registros")
    except Exception as e:
        print("Error al obtener pedidos para ventas semanales:", e)
        return {
            "ventas_semana_actual": 0,
            "ventas_semana_pasada": 0,
            "pedidos_semana_actual": 0,
            "pedidos_semana_pasada": 0,
            "porcentaje_cambio": 0,
            "es_positivo": True
        }
    
    try:
        df = pd.DataFrame(pedidos)
        
        # Filtrar Aguas Ancud
        if 'nombrelocal' in df.columns:
            df = df[df['nombrelocal'] == 'Aguas Ancud']
        
        if df.empty or 'fecha' not in df.columns:
            return {
                "ventas_semana_actual": 0,
                "ventas_semana_pasada": 0,
                "pedidos_semana_actual": 0,
                "pedidos_semana_pasada": 0,
                "porcentaje_cambio": 0,
                "es_positivo": True
            }
        
        # Procesar fechas y precios
        df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
        df = df.dropna(subset=['fecha_parsed'])
        df['precio'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)
        
        # Calcular fechas de semana
        hoy = datetime.now().date()
        inicio_semana_actual = hoy - timedelta(days=hoy.weekday())
        fin_semana_actual = inicio_semana_actual + timedelta(days=6)
        
        inicio_semana_pasada = inicio_semana_actual - timedelta(days=7)
        fin_semana_pasada = fin_semana_actual - timedelta(days=7)
        
        # Filtrar pedidos por semana
        pedidos_semana_actual = df[
            (df['fecha_parsed'].dt.date >= inicio_semana_actual) & 
            (df['fecha_parsed'].dt.date <= fin_semana_actual)
        ]
        
        pedidos_semana_pasada = df[
            (df['fecha_parsed'].dt.date >= inicio_semana_pasada) & 
            (df['fecha_parsed'].dt.date <= fin_semana_pasada)
        ]
        
        # Calcular métricas
        ventas_semana_actual = pedidos_semana_actual['precio'].sum()
        pedidos_semana_actual_count = len(pedidos_semana_actual)
        
        ventas_semana_pasada = pedidos_semana_pasada['precio'].sum()
        pedidos_semana_pasada_count = len(pedidos_semana_pasada)

        # Calcular porcentaje de cambio
        if ventas_semana_pasada > 0:
            porcentaje_cambio = ((ventas_semana_actual - ventas_semana_pasada) / ventas_semana_pasada) * 100
            es_positivo = bool(ventas_semana_actual >= ventas_semana_pasada)
        else:
            porcentaje_cambio = 100 if ventas_semana_actual > 0 else 0
            es_positivo = bool(ventas_semana_actual > 0)
        
        resultado = {
            "ventas_semana_actual": int(ventas_semana_actual),
            "ventas_semana_pasada": int(ventas_semana_pasada),
            "pedidos_semana_actual": pedidos_semana_actual_count,
            "pedidos_semana_pasada": pedidos_semana_pasada_count,
            "porcentaje_cambio": round(porcentaje_cambio, 1),
            "es_positivo": es_positivo,
            "fecha_inicio_semana": inicio_semana_actual.strftime("%d-%m-%Y"),
            "fecha_fin_semana": fin_semana_actual.strftime("%d-%m-%Y")
        }
        
        print("=== VENTAS SEMANALES ===")
        print(f"Ventas semana actual: ${ventas_semana_actual:,}")
        print(f"Ventas semana pasada: ${ventas_semana_pasada:,}")
        print(f"Pedidos semana actual: {pedidos_semana_actual_count}")
        print("=======================")
        
        return resultado
        
    except Exception as e:
        print(f"Error en cálculo de ventas semanales: {e}")
        return {
            "ventas_semana_actual": 0,
            "ventas_semana_pasada": 0,
            "pedidos_semana_actual": 0,
            "pedidos_semana_pasada": 0,
            "porcentaje_cambio": 0,
            "es_positivo": True
        }

@app.get("/pedidos-por-horario", response_model=Dict)
def get_pedidos_por_horario():
    """Calcular pedidos por horario reales, acotado al mes actual.

    Antes se calculaba sobre TODO el histórico de pedidos, lo que hacía que
    el resultado se sintiera "congelado": con años de datos acumulados, un
    día de pedidos nuevos no mueve el porcentaje de forma perceptible.
    Acotarlo al mes en curso lo alinea con el resto de los KPIs (ventas_mes,
    clientes_activos, etc.) y hace que refleje la actividad reciente real.
    """
    try:
        pedidos = data_adapter.obtener_pedidos_combinados()
        if not pedidos:
            raise Exception("Sin datos")
    except Exception as e:
        logger.error(f"Error al obtener pedidos para horarios: {e}")
        return {
            "pedidos_manana": 0,
            "pedidos_tarde": 0,
            "total": 0,
            "porcentaje_manana": 0,
            "porcentaje_tarde": 0
        }

    try:
        df = pd.DataFrame(pedidos)

        # Filtrar Aguas Ancud
        if 'nombrelocal' in df.columns:
            df = df[df['nombrelocal'] == 'Aguas Ancud']

        # Acotar al mes actual (misma convención que /kpis)
        if 'fecha' in df.columns:
            df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
            hoy = datetime.now()
            df = df[
                (df['fecha_parsed'].dt.month == hoy.month) &
                (df['fecha_parsed'].dt.year == hoy.year)
            ]

        if df.empty:
            return {
                "pedidos_manana": 0,
                "pedidos_tarde": 0,
                "total": 0,
                "porcentaje_manana": 0,
                "porcentaje_tarde": 0
            }

        # Calcular bloques
        bloque_manana = 0
        bloque_tarde = 0
        
        import re
        for _, pedido in df.iterrows():
            if pd.notna(pedido.get('hora')):
                hora_str = str(pedido['hora']).strip()
                hora = None

                # Formato 24h: "14:30:00" o "14:30"
                match_24h = re.match(r'^(\d{1,2}):\d{2}', hora_str)
                if match_24h:
                    hora = int(match_24h.group(1))

                # Formato 12h: "02:53 pm" o "11:30 am"
                if hora is None:
                    match_12h = re.match(r'(\d{1,2}):(\d{2})\s*(am|pm)', hora_str.lower())
                    if match_12h:
                        hora = int(match_12h.group(1))
                        ampm = match_12h.group(3)
                        if ampm == 'pm' and hora != 12:
                            hora += 12
                        elif ampm == 'am' and hora == 12:
                            hora = 0

                if hora is not None:
                    if 11 <= hora < 13:
                        bloque_manana += 1
                    elif 15 <= hora < 19:
                        bloque_tarde += 1
        
        total = bloque_manana + bloque_tarde
        
        if total > 0:
            porcentaje_manana = round((bloque_manana / total) * 100)
            porcentaje_tarde = round((bloque_tarde / total) * 100)
        else:
            porcentaje_manana = 0
            porcentaje_tarde = 0
        
        resultado = {
            "pedidos_manana": bloque_manana,
            "pedidos_tarde": bloque_tarde,
            "total": total,
            "porcentaje_manana": porcentaje_manana,
            "porcentaje_tarde": porcentaje_tarde
        }
        
        print("=== PEDIDOS POR HORARIO ===")
        print(f"Mañana (11-13h): {bloque_manana} ({porcentaje_manana}%)")
        print(f"Tarde (15-19h): {bloque_tarde} ({porcentaje_tarde}%)")
        print(f"Total: {total}")
        print("==========================")
        
        return resultado
        
    except Exception as e:
        print(f"Error en cálculo de pedidos por horario: {e}")
        return {
            "pedidos_manana": 0,
            "pedidos_tarde": 0,
            "total": 0,
            "porcentaje_manana": 0,
            "porcentaje_tarde": 0
        }

@app.get("/inventario/estado", response_model=Dict)
def get_estado_inventario():
    """Obtener estado actual del inventario de bidones"""
    try:
        # Obtener pedidos recientes para calcular demanda
        pedidos = data_adapter.obtener_pedidos_combinados()

        df = pd.DataFrame(pedidos)
        if 'nombrelocal' in df.columns:
            df = df[df['nombrelocal'].str.strip().str.lower() == 'aguas ancud']
        
        if df.empty:
            return {
                "stock_actual": 0,
                "stock_minimo": 50,
                "stock_maximo": 200,
                "demanda_diaria_promedio": 0,
                "dias_restantes": 0,
                "estado": "sin_datos",
                "alertas": [],
                "recomendaciones": []
            }
        
        # Calcular demanda diaria promedio (últimos 7 días)
        df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
        df = df.dropna(subset=['fecha_parsed'])
        
        fecha_limite = datetime.now() - timedelta(days=7)
        df_reciente = df[df['fecha_parsed'] >= fecha_limite]
        
        if not df_reciente.empty:
            demanda_diaria = len(df_reciente) / 7
        else:
            demanda_diaria = 0
        
        # El stock real requiere integración con bodega — estimamos basado en demanda reciente
        # Asumimos reposición semanal: capacidad semanal estimada 200 bidones
        bidones_vendidos_semana = len(df_reciente)
        stock_actual = max(0, 200 - bidones_vendidos_semana)  # Reposición semanal estimada
        stock_minimo = 50
        stock_maximo = 200
        
        # Calcular días restantes
        dias_restantes = stock_actual / demanda_diaria if demanda_diaria > 0 else float('inf')
        
        # Determinar estado
        if stock_actual <= stock_minimo:
            estado = "critico"
        elif stock_actual <= stock_minimo * 1.5:
            estado = "bajo"
        elif stock_actual >= stock_maximo * 0.8:
            estado = "alto"
        else:
            estado = "normal"
        
        # Generar alertas
        alertas = []
        if stock_actual <= stock_minimo:
            alertas.append({
                "tipo": "critico",
                "mensaje": f"Stock crítico: Solo {stock_actual} bidones disponibles",
                "prioridad": "alta"
            })
        elif stock_actual <= stock_minimo * 1.5:
            alertas.append({
                "tipo": "advertencia",
                "mensaje": f"Stock bajo: {stock_actual} bidones disponibles",
                "prioridad": "media"
            })
        
        if dias_restantes < 3 and dias_restantes != float('inf'):
            alertas.append({
                "tipo": "urgente",
                "mensaje": f"Solo {dias_restantes:.1f} días de stock restantes",
                "prioridad": "alta"
            })
        
        # Generar recomendaciones
        recomendaciones = []
        if stock_actual <= stock_minimo:
            cantidad_reponer = stock_maximo - stock_actual
            recomendaciones.append({
                "accion": "reponer_inventario",
                "descripcion": f"Reponer {cantidad_reponer} bidones urgentemente",
                "prioridad": "alta"
            })
        elif stock_actual <= stock_minimo * 1.5:
            cantidad_reponer = stock_maximo - stock_actual
            recomendaciones.append({
                "accion": "reponer_inventario",
                "descripcion": f"Planificar reposición de {cantidad_reponer} bidones",
                "prioridad": "media"
            })
        
        if demanda_diaria > 0:
            recomendaciones.append({
                "accion": "analizar_demanda",
                "descripcion": f"Demanda diaria promedio: {demanda_diaria:.1f} bidones",
                "prioridad": "baja"
            })
        
        resultado = {
            "stock_actual": int(stock_actual),
            "stock_minimo": stock_minimo,
            "stock_maximo": stock_maximo,
            "demanda_diaria_promedio": round(demanda_diaria, 1),
            "dias_restantes": round(dias_restantes, 1) if dias_restantes != float('inf') else None,
            "estado": estado,
            "alertas": alertas,
            "recomendaciones": recomendaciones,
            "ultima_actualizacion": datetime.now().isoformat()
        }
        
        print("=== INVENTARIO ===")
        print(f"Stock actual: {stock_actual}")
        print(f"Demanda diaria: {demanda_diaria:.1f}")
        print(f"Días restantes: {dias_restantes:.1f}")
        print(f"Estado: {estado}")
        print("==================")
        
        return resultado
        
    except Exception as e:
        print(f"Error obteniendo estado de inventario: {e}")
        return {
            "stock_actual": 0,
            "stock_minimo": 50,
            "stock_maximo": 200,
            "demanda_diaria_promedio": 0,
            "dias_restantes": 0,
            "estado": "error",
            "alertas": [{"tipo": "error", "mensaje": "Error obteniendo datos", "prioridad": "alta"}],
            "recomendaciones": []
        }

@app.get("/inventario/prediccion", response_model=Dict)
def get_prediccion_inventario(dias: int = Query(7, description="Días a predecir")):
    """Predecir necesidades de inventario para los próximos días"""
    try:
        # Obtener datos históricos
        pedidos = data_adapter.obtener_pedidos_combinados()

        df = pd.DataFrame(pedidos)
        if 'nombrelocal' in df.columns:
            df = df[df['nombrelocal'].str.strip().str.lower() == 'aguas ancud']
        
        if df.empty:
            return {"error": "No hay datos suficientes para predicción"}
        
        # Procesar fechas
        df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
        df = df.dropna(subset=['fecha_parsed'])
        
        # Calcular demanda por día de la semana
        df['dia_semana'] = df['fecha_parsed'].dt.dayofweek
        demanda_por_dia = df.groupby('dia_semana').size().to_dict()
        
        # Predicción para los próximos días
        predicciones = []
        fecha_actual = datetime.now()
        
        for i in range(dias):
            fecha_futura = fecha_actual + timedelta(days=i)
            dia_semana = fecha_futura.weekday()
            
            # Predicción basada en demanda histórica por día de la semana
            demanda_predicha = demanda_por_dia.get(dia_semana, 0)
            
            # Ajustar por tendencia (últimos 30 días)
            fecha_limite = fecha_actual - timedelta(days=30)
            df_reciente = df[df['fecha_parsed'] >= fecha_limite]
            
            if not df_reciente.empty:
                tendencia = len(df_reciente) / 30  # Promedio diario
                demanda_predicha = max(0, demanda_predicha * (tendencia / max(demanda_por_dia.values()) if demanda_por_dia else 1))
            
            predicciones.append({
                "fecha": fecha_futura.strftime("%d-%m-%Y"),
                "dia_semana": ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][dia_semana],
                "demanda_predicha": round(demanda_predicha, 1),
                "stock_necesario": max(50, round(demanda_predicha * 1.5))  # Stock de seguridad
            })
        
        return {
            "predicciones": predicciones,
            "resumen": {
                "demanda_total_predicha": sum(p["demanda_predicha"] for p in predicciones),
                "stock_total_necesario": sum(p["stock_necesario"] for p in predicciones),
                "dias_analizados": dias
            }
        }
        
    except Exception as e:
        print(f"Error en predicción de inventario: {e}")
        return {"error": f"Error en predicción: {str(e)}"}

@app.get("/reportes/ejecutivo", response_model=Dict)
def get_reporte_ejecutivo():
    """Generar reporte ejecutivo semanal automático"""
    try:
        # Obtener datos de pedidos
        pedidos = data_adapter.obtener_pedidos_combinados()

        df = pd.DataFrame(pedidos)
        if 'nombrelocal' in df.columns:
            df = df[df['nombrelocal'].str.strip().str.lower() == 'aguas ancud']
        
        if df.empty:
            return {"error": "No hay datos suficientes para el reporte"}
        
        # Procesar fechas y precios
        df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
        df = df.dropna(subset=['fecha_parsed'])
        df['precio'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)
        
        # Calcular fechas precisas
        fecha_actual = datetime.now()
        inicio_semana = fecha_actual - timedelta(days=7)
        inicio_mes = fecha_actual.replace(day=1)
        inicio_mes_anterior = (inicio_mes - timedelta(days=1)).replace(day=1)
        
        # Filtrar datos por períodos exactos
        df_semana = df[df['fecha_parsed'] >= inicio_semana]
        df_mes = df[df['fecha_parsed'] >= inicio_mes]
        df_mes_anterior = df[(df['fecha_parsed'] >= inicio_mes_anterior) & (df['fecha_parsed'] < inicio_mes)]
        
        # Calcular métricas reales
        ventas_semana = int(df_semana['precio'].sum())
        ventas_mes = int(df_mes['precio'].sum())
        ventas_mes_anterior = int(df_mes_anterior['precio'].sum())
        
        pedidos_semana = len(df_semana)
        pedidos_mes = len(df_mes)
        pedidos_mes_anterior = len(df_mes_anterior)
        
        # Calcular crecimiento real
        crecimiento_ventas = 0
        if ventas_mes_anterior > 0:
            crecimiento_ventas = round(((ventas_mes - ventas_mes_anterior) / ventas_mes_anterior) * 100, 1)
        
        crecimiento_pedidos = 0
        if pedidos_mes_anterior > 0:
            crecimiento_pedidos = round(((pedidos_mes - pedidos_mes_anterior) / pedidos_mes_anterior) * 100, 1)
        
        # Análisis de clientes únicos
        clientes_unicos_semana = df_semana['usuario'].nunique() if not df_semana.empty else 0
        clientes_unicos_mes = df_mes['usuario'].nunique() if not df_mes.empty else 0
        
        # Análisis de días de la semana (solo si hay datos)
        dia_mas_ventas = None
        if not df_semana.empty:
            df_semana['dia_semana'] = df_semana['fecha_parsed'].dt.dayofweek
            pedidos_por_dia = df_semana.groupby('dia_semana').size()
            if not pedidos_por_dia.empty:
                dia_mas_ventas = pedidos_por_dia.idxmax()
        
        dias_semana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        
        # Generar insights más precisos
        insights = []
        
        if crecimiento_ventas > 5:
            insights.append({
                "tipo": "positivo",
                "titulo": "Crecimiento Sólido",
                "descripcion": f"Ventas +{crecimiento_ventas}% vs mes anterior"
            })
        elif crecimiento_ventas < -5:
            insights.append({
                "tipo": "negativo",
                "titulo": "Atención Requerida",
                "descripcion": f"Ventas {crecimiento_ventas}% vs mes anterior"
            })
        
        if clientes_unicos_mes > 0:
            insights.append({
                "tipo": "informativo",
                "titulo": "Base de Clientes",
                "descripcion": f"{clientes_unicos_mes} clientes únicos este mes"
            })
        
        if dia_mas_ventas is not None:
            insights.append({
                "tipo": "informativo",
                "titulo": "Día Pico",
                "descripcion": f"{dias_semana[dia_mas_ventas]} más activo"
            })
        
        # Recomendaciones más específicas
        recomendaciones = []
        
        if crecimiento_ventas < 0:
            recomendaciones.append({
                "prioridad": "alta",
                "accion": "Analizar causas",
                "descripcion": "Revisar estrategias de ventas"
            })
        
        if clientes_unicos_semana < 5:
            recomendaciones.append({
                "prioridad": "media",
                "accion": "Captación",
                "descripcion": "Pocos clientes nuevos"
            })
        
        # Generar resumen ejecutivo compacto
        resumen_ejecutivo = {
            "periodo": {
                "semana": f"{inicio_semana.strftime('%d/%m')} - {fecha_actual.strftime('%d/%m')}",
                "mes": fecha_actual.strftime('%B %Y')
            },
            "metricas": {
                "ventas_semana": ventas_semana,
                "ventas_mes": ventas_mes,
                "crecimiento_ventas": crecimiento_ventas,
                "pedidos_semana": pedidos_semana,
                "pedidos_mes": pedidos_mes,
                "crecimiento_pedidos": crecimiento_pedidos,
                "clientes_unicos_semana": clientes_unicos_semana,
                "clientes_unicos_mes": clientes_unicos_mes
            },
            "analisis": {
                "dia_mas_ventas": dias_semana[dia_mas_ventas] if dia_mas_ventas is not None else "N/A",
                "promedio_diario_semana": round(pedidos_semana / 7, 1) if pedidos_semana > 0 else 0
            },
            "insights": insights[:3],  # Máximo 3 insights
            "recomendaciones": recomendaciones[:2],  # Máximo 2 recomendaciones
            "fecha_generacion": fecha_actual.isoformat()
        }
        
        print("=== REPORTE EJECUTIVO ===")
        print(f"Ventas semana: ${ventas_semana:,}")
        print(f"Ventas mes: ${ventas_mes:,}")
        print(f"Crecimiento: {crecimiento_ventas}%")
        print(f"Clientes únicos: {clientes_unicos_mes}")
        print("=========================")
        
        return resumen_ejecutivo
        
    except Exception as e:
        print(f"Error generando reporte ejecutivo: {e}")
        return {"error": f"Error generando reporte: {str(e)}"}

@app.get("/reportes/email", response_model=Dict)
def generar_reporte_email(email: str = Query(..., description="Email para enviar reporte")):
    """Generar y enviar reporte por email"""
    try:
        # Obtener reporte ejecutivo
        reporte = get_reporte_ejecutivo()
        
        if "error" in reporte:
            return {"error": reporte["error"]}
        
        # Generar contenido HTML del email
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background: #3b82f6; color: white; padding: 20px; border-radius: 8px; }}
                .metric {{ background: #f8fafc; padding: 15px; margin: 10px 0; border-radius: 8px; }}
                .positive {{ color: #059669; }}
                .negative {{ color: #dc2626; }}
                .insight {{ background: #fef3c7; padding: 10px; margin: 10px 0; border-radius: 5px; }}
                .recommendation {{ background: #dbeafe; padding: 10px; margin: 10px 0; border-radius: 5px; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📊 Reporte Ejecutivo - Aguas Ancud</h1>
                <p>Período: {reporte['periodo']['semana']} | {reporte['periodo']['mes']}</p>
            </div>
            
            <h2>📈 Métricas Principales</h2>
            <div class="metric">
                <h3>Ventas</h3>
                <p>Semana: ${reporte['metricas']['ventas_semana']:,}</p>
                <p>Mes: ${reporte['metricas']['ventas_mes']:,}</p>
                <p class="{'positive' if reporte['metricas']['crecimiento_ventas'] > 0 else 'negative'}">
                    Crecimiento: {reporte['metricas']['crecimiento_ventas']}%
                </p>
            </div>
            
            <div class="metric">
                <h3>Pedidos</h3>
                <p>Semana: {reporte['metricas']['pedidos_semana']}</p>
                <p>Mes: {reporte['metricas']['pedidos_mes']}</p>
                <p class="{'positive' if reporte['metricas']['crecimiento_pedidos'] > 0 else 'negative'}">
                    Crecimiento: {reporte['metricas']['crecimiento_pedidos']}%
                </p>
            </div>
            
            <div class="metric">
                <h3>Clientes</h3>
                <p>Únicos semana: {reporte['metricas']['clientes_unicos_semana']}</p>
                <p>Únicos mes: {reporte['metricas']['clientes_unicos_mes']}</p>
            </div>
            
            <h2>🔍 Insights</h2>
            {''.join([f'<div class="insight"><strong>{insight["titulo"]}:</strong> {insight["descripcion"]}</div>' for insight in reporte['insights']])}
            
            <h2>💡 Recomendaciones</h2>
            {''.join([f'<div class="recommendation"><strong>{rec["accion"]}:</strong> {rec["descripcion"]}</div>' for rec in reporte['recomendaciones']])}
            
            <hr>
            <p><em>Reporte generado automáticamente el {datetime.now().strftime('%d/%m/%Y %H:%M')}</em></p>
        </body>
        </html>
        """
        
        # En producción, aquí se enviaría el email
        # Por ahora, solo retornamos el contenido
        return {
            "mensaje": "Reporte generado exitosamente",
            "email": email,
            "contenido_html": html_content,
            "fecha_envio": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Error generando reporte email: {e}")
        return {"error": f"Error generando reporte email: {str(e)}"}

@app.get("/rentabilidad/avanzado", response_model=Dict)
def get_analisis_rentabilidad():
    """Análisis de rentabilidad avanzado con métricas detalladas basadas en datos reales de KPIs"""
    try:
        # Obtener datos de pedidos
        pedidos = data_adapter.obtener_pedidos_combinados()

        df = pd.DataFrame(pedidos)
        if 'nombrelocal' in df.columns:
            df = df[df['nombrelocal'].str.strip().str.lower() == 'aguas ancud']
        
        if df.empty:
            return {"error": "No hay datos suficientes para el análisis"}
        
        # Procesar fechas y precios (MISMO MÉTODO QUE KPIs)
        df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
        df = df.dropna(subset=['fecha_parsed'])
        df['precio'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)
        df['cantidad'] = df['precio'] // 2000  # Mismo cálculo que KPIs
        
        # Calcular fechas (MISMO MÉTODO QUE KPIs)
        hoy = datetime.now()
        mes_actual = hoy.month
        anio_actual = hoy.year
        
        # Mes pasado
        if mes_actual == 1:
            mes_pasado = 12
            anio_pasado = anio_actual - 1
        else:
            mes_pasado = mes_actual - 1
            anio_pasado = anio_actual
        
        # Filtrar pedidos por mes (MISMO MÉTODO QUE KPIs)
        pedidos_mes = df[(df['fecha_parsed'].dt.month == mes_actual) & (df['fecha_parsed'].dt.year == anio_actual)]
        pedidos_mes_pasado = df[(df['fecha_parsed'].dt.month == mes_pasado) & (df['fecha_parsed'].dt.year == anio_pasado)]
        
        # Calcular métricas básicas (MISMO MÉTODO QUE KPIs)
        ventas_mes = pedidos_mes['precio'].sum()
        ventas_mes_pasado = pedidos_mes_pasado['precio'].sum()
        
        # Calcular bidones basado en ordenpedido
        if 'ordenpedido' in pedidos_mes.columns:
            total_bidones_mes = pedidos_mes['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
        else:
            total_bidones_mes = len(pedidos_mes)  # Fallback: 1 bidón por pedido
        
        if 'ordenpedido' in pedidos_mes_pasado.columns:
            total_bidones_mes_pasado = pedidos_mes_pasado['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
        else:
            total_bidones_mes_pasado = len(pedidos_mes_pasado)  # Fallback: 1 bidón por pedido
        
        # CÁLCULOS REALES DE COSTOS (MISMO MÉTODO QUE KPIs)
        cuota_camion = 260000  # Costo fijo mensual del camión
        costo_tapa = 51  # Costo por tapa (sin IVA)
        precio_venta_bidon = 2000
        
        # Costo por bidón: 1 tapa + IVA
        costo_tapa_con_iva = costo_tapa * 1.19  # 51 + 19% IVA = 60.69 pesos
        costos_variables = costo_tapa_con_iva * total_bidones_mes  # Costos por bidones vendidos
        costos_fijos = cuota_camion  # Costo fijo del camión
        costos_totales = costos_fijos + costos_variables  # Costos fijos + variables
        
        # Cálculo de IVA (precio $2.000 incluye IVA → extraer débito fiscal)
        iva_ventas = (ventas_mes / 1.19) * 0.19  # Débito fiscal
        iva_tapas = costo_tapa * total_bidones_mes * 0.19  # Crédito fiscal tapas
        iva = iva_ventas - iva_tapas  # IVA neto a pagar

        # Cálculo de IVA del mes pasado
        iva_ventas_mes_pasado = (ventas_mes_pasado / 1.19) * 0.19
        iva_tapas_mes_pasado = costo_tapa * total_bidones_mes_pasado * 0.19
        iva_mes_pasado = iva_ventas_mes_pasado - iva_tapas_mes_pasado
        
        # Cálculo de utilidad (MISMO MÉTODO QUE KPIs)
        utilidad = ventas_mes - costos_totales
        
        # Cálculo punto de equilibrio (MISMO MÉTODO QUE KPIs)
        try:
            punto_equilibrio = int(round(cuota_camion / (precio_venta_bidon - costo_tapa_con_iva)))
        except ZeroDivisionError:
            punto_equilibrio = 0
        
        # Calcular rentabilidad REAL
        margen_bruto = ventas_mes - costos_variables
        margen_neto = utilidad  # Usar la utilidad calculada por KPIs
        
        # Validar que los cálculos sean razonables antes de generar insights
        margen_bruto_porcentaje = round((margen_bruto / ventas_mes) * 100, 1) if ventas_mes > 0 else 0
        margen_neto_porcentaje = round((margen_neto / ventas_mes) * 100, 1) if ventas_mes > 0 else 0
        
        # Asegurar que los valores estén en rango razonable (validación)
        margen_neto_porcentaje = max(-100, min(100, margen_neto_porcentaje))  # Entre -100% y 100%
        
        # ROI mensual REAL
        roi_mensual = round((margen_neto / (costos_totales)) * 100, 1) if costos_totales > 0 else 0
        
        # Asegurar que ROI esté en rango razonable
        roi_mensual = max(-100, min(200, roi_mensual))  # Entre -100% y 200%
        
        # Análisis por cliente REAL
        clientes_unicos = pedidos_mes['usuario'].nunique() if not pedidos_mes.empty else 0
        ticket_promedio = int(ventas_mes / len(pedidos_mes)) if len(pedidos_mes) > 0 else 0
        margen_por_cliente = int(margen_neto / clientes_unicos) if clientes_unicos > 0 else 0
        
        # Análisis de tendencias REAL
        crecimiento_ventas = 0
        if ventas_mes_pasado > 0:
            crecimiento_ventas = round(((ventas_mes - ventas_mes_pasado) / ventas_mes_pasado) * 100, 1)
        
        # Análisis de eficiencia REAL
        eficiencia_operacional = round((margen_neto / ventas_mes) * 100, 1) if ventas_mes > 0 else 0
        
        # Asegurar que eficiencia esté en rango razonable
        eficiencia_operacional = max(-100, min(100, eficiencia_operacional))  # Entre -100% y 100%
        
        # === NUEVOS ANÁLISIS AVANZADOS ===
        
        # 1. CRECIMIENTO MENSUAL VS TRIMESTRAL
        # Calcular últimos 3 meses
        if mes_actual >= 3:
            mes_3_atras = mes_actual - 2
            mes_2_atras = mes_actual - 1
            anio_3_atras = anio_actual
            anio_2_atras = anio_actual
        else:
            mes_3_atras = 12 + (mes_actual - 2)
            mes_2_atras = 12 + (mes_actual - 1)
            anio_3_atras = anio_actual - 1
            anio_2_atras = anio_actual - 1
        
        # Filtrar por meses
        pedidos_mes_3_atras = df[(df['fecha_parsed'].dt.month == mes_3_atras) & (df['fecha_parsed'].dt.year == anio_3_atras)]
        pedidos_mes_2_atras = df[(df['fecha_parsed'].dt.month == mes_2_atras) & (df['fecha_parsed'].dt.year == anio_2_atras)]
        
        ventas_mes_3_atras = pedidos_mes_3_atras['precio'].sum()
        ventas_mes_2_atras = pedidos_mes_2_atras['precio'].sum()
        
        # Crecimiento mensual vs trimestral
        crecimiento_mensual = round(((ventas_mes - ventas_mes_pasado) / ventas_mes_pasado) * 100, 1) if ventas_mes_pasado > 0 else 0
        ventas_trimestre = ventas_mes + ventas_mes_pasado + ventas_mes_2_atras
        ventas_trimestre_anterior = ventas_mes_3_atras + ventas_mes_pasado + ventas_mes_2_atras
        crecimiento_trimestral = round(((ventas_trimestre - ventas_trimestre_anterior) / ventas_trimestre_anterior) * 100, 1) if ventas_trimestre_anterior > 0 else 0
        
        # 2. ESTACIONALIDAD (VERANO VS INVIERNO)
        # Verano: Diciembre, Enero, Febrero (meses 12, 1, 2)
        # Invierno: Junio, Julio, Agosto (meses 6, 7, 8)
        pedidos_verano = df[df['fecha_parsed'].dt.month.isin([12, 1, 2])]
        pedidos_invierno = df[df['fecha_parsed'].dt.month.isin([6, 7, 8])]
        
        ventas_verano = pedidos_verano['precio'].sum()
        ventas_invierno = pedidos_invierno['precio'].sum()
        
        # Promedio por mes en cada estación
        meses_verano = len(pedidos_verano['fecha_parsed'].dt.to_period('M').unique())
        meses_invierno = len(pedidos_invierno['fecha_parsed'].dt.to_period('M').unique())
        
        promedio_verano = ventas_verano / meses_verano if meses_verano > 0 else 0
        promedio_invierno = ventas_invierno / meses_invierno if meses_invierno > 0 else 0
        
        factor_estacional = round(promedio_verano / promedio_invierno, 2) if promedio_invierno > 0 else 1
        
        # 3. CRECIMIENTO DE VENTAS POR ZONA
        # Extraer zona de la dirección
        def extraer_zona_rentabilidad(direccion):
            if pd.isna(direccion) or direccion == '':
                return 'Sin zona'
            direccion_lower = str(direccion).lower()
            if 'ancud' in direccion_lower:
                return 'Ancud Centro'
            elif 'puerto' in direccion_lower:
                return 'Puerto Ancud'
            elif 'rural' in direccion_lower or 'camino' in direccion_lower:
                return 'Zona Rural'
            else:
                return 'Otras Zonas'
        
        pedidos_mes['zona'] = pedidos_mes['dire'].apply(extraer_zona_rentabilidad)
        ventas_por_zona = pedidos_mes.groupby('zona')['precio'].sum().to_dict()
        
        # 4. PROYECCIÓN DE VENTAS PRÓXIMOS 3 MESES
        # Calcular tendencia mensual (asegurar que no sea 0 si hay datos)
        if ventas_mes_pasado > 0:
            tendencia_mensual = (ventas_mes - ventas_mes_pasado) / ventas_mes_pasado
        elif ventas_mes > 0:
            # Si no hay mes pasado pero sí hay mes actual, asumir crecimiento del 5%
            tendencia_mensual = 0.05
        else:
            # Si no hay datos, usar tendencia neutral
            tendencia_mensual = 0
        
        mes_proyeccion = mes_actual + 1
        if mes_proyeccion > 12:
            mes_proyeccion = 1
        
        factor_estacional_proyeccion = 1.2 if mes_proyeccion in [12, 1, 2] else 0.9 if mes_proyeccion in [6, 7, 8] else 1.0
        
        # Asegurar que si ventas_mes es 0, usemos un valor base mínimo para proyecciones
        ventas_base_proyeccion = ventas_mes if ventas_mes > 0 else max(ventas_mes_pasado, 1000000)  # $1M mínimo si no hay datos
        
        proyeccion_mes_1 = int(ventas_base_proyeccion * (1 + tendencia_mensual) * factor_estacional_proyeccion)
        proyeccion_mes_2 = int(proyeccion_mes_1 * (1 + tendencia_mensual * 0.8))
        proyeccion_mes_3 = int(proyeccion_mes_2 * (1 + tendencia_mensual * 0.6))
        
        # 5. PUNTO DE EQUILIBRIO DINÁMICO
        punto_equilibrio_optimista = int(round(cuota_camion * 0.9 / (precio_venta_bidon * 1.1 - costo_tapa_con_iva * 0.95)))
        punto_equilibrio_pesimista = int(round(cuota_camion * 1.1 / (precio_venta_bidon * 0.9 - costo_tapa_con_iva * 1.05)))
        
        # 6. ESCENARIOS DE RENTABILIDAD
        # Asegurar que los escenarios se calculen correctamente incluso si ventas_mes es 0
        ventas_base_escenarios = ventas_mes if ventas_mes > 0 else max(ventas_mes_pasado, punto_equilibrio * precio_venta_bidon)
        
        ventas_optimista = int(ventas_base_escenarios * 1.2)
        costos_optimista = int(costos_totales * 0.9)
        utilidad_optimista = ventas_optimista - costos_optimista
        margen_optimista = round((utilidad_optimista / ventas_optimista) * 100, 1) if ventas_optimista > 0 else 0
        
        ventas_pesimista = int(ventas_base_escenarios * 0.8)
        costos_pesimista = int(costos_totales * 1.1)
        utilidad_pesimista = ventas_pesimista - costos_pesimista
        margen_pesimista = round((utilidad_pesimista / ventas_pesimista) * 100, 1) if ventas_pesimista > 0 else 0
        

        
        # Generar insights REALES (con cobertura completa)
        insights = []
        
        # 1. INSIGHT: Margen Neto (con todos los rangos)
        if margen_neto_porcentaje > 15:
            insights.append({
                "tipo": "positivo",
                "titulo": "Rentabilidad Sólida",
                "descripcion": f"Margen neto del {margen_neto_porcentaje}% - Excelente gestión financiera"
            })
        elif margen_neto_porcentaje >= 10:
            insights.append({
                "tipo": "positivo",
                "titulo": "Rentabilidad Moderada",
                "descripcion": f"Margen neto del {margen_neto_porcentaje}% - Rentabilidad aceptable, con potencial de mejora"
            })
        elif margen_neto_porcentaje >= 5:
            insights.append({
                "tipo": "negativo",
                "titulo": "Rentabilidad Baja",
                "descripcion": f"Margen neto del {margen_neto_porcentaje}% - Margen reducido, requiere optimización"
            })
        else:
            insights.append({
                "tipo": "negativo",
                "titulo": "Rentabilidad Crítica",
                "descripcion": f"Margen neto del {margen_neto_porcentaje}% - Requiere atención inmediata"
            })
        
        # 2. INSIGHT: ROI Mensual (con todos los rangos)
        if roi_mensual > 10:
            insights.append({
                "tipo": "positivo",
                "titulo": "ROI Competitivo",
                "descripcion": f"Retorno del {roi_mensual}% - Buen rendimiento sobre inversión"
            })
        elif roi_mensual >= 8:
            insights.append({
                "tipo": "positivo",
                "titulo": "ROI Moderado",
                "descripcion": f"Retorno del {roi_mensual}% - Rendimiento aceptable, posibilidad de optimización"
            })
        elif roi_mensual >= 5:
            insights.append({
                "tipo": "negativo",
                "titulo": "ROI Bajo",
                "descripcion": f"Retorno del {roi_mensual}% - Requiere mejoras operativas"
            })
        else:
            insights.append({
                "tipo": "negativo",
                "titulo": "ROI Crítico",
                "descripcion": f"Retorno del {roi_mensual}% - Necesita optimización urgente"
            })
        
        # 3. INSIGHT: Punto de Equilibrio (con análisis de cercanía)
        diferencia_equilibrio = ventas_mes - (punto_equilibrio * precio_venta_bidon)
        porcentaje_equilibrio = (ventas_mes / (punto_equilibrio * precio_venta_bidon)) * 100 if punto_equilibrio > 0 else 0
        
        if diferencia_equilibrio > 0:
            if porcentaje_equilibrio > 150:
                insights.append({
                    "tipo": "positivo",
                    "titulo": "Muy Sobre Punto de Equilibrio",
                    "descripcion": f"${diferencia_equilibrio:,} sobre equilibrio ({porcentaje_equilibrio:.0f}%) - Operación muy rentable"
                })
            else:
                insights.append({
                    "tipo": "positivo",
                    "titulo": "Sobre Punto de Equilibrio",
                    "descripcion": f"${diferencia_equilibrio:,} sobre equilibrio - Operación rentable"
                })
        elif porcentaje_equilibrio >= 90:
            insights.append({
                "tipo": "negativo",
                "titulo": "Cerca del Punto de Equilibrio",
                "descripcion": f"Faltan ${abs(diferencia_equilibrio):,} para equilibrio ({porcentaje_equilibrio:.0f}%) - Riesgo de pérdidas"
            })
        else:
            insights.append({
                "tipo": "negativo",
                "titulo": "Bajo Punto de Equilibrio",
                "descripcion": f"Faltan ${abs(diferencia_equilibrio):,} para equilibrio ({porcentaje_equilibrio:.0f}%) - Operación no rentable"
            })
        
        # 4. INSIGHT: Eficiencia Operacional (con todos los rangos)
        if eficiencia_operacional > 10:
            insights.append({
                "tipo": "positivo",
                "titulo": "Eficiencia Operacional Alta",
                "descripcion": f"Eficiencia del {eficiencia_operacional}% - Operación optimizada"
            })
        elif eficiencia_operacional >= 5:
            insights.append({
                "tipo": "negativo",
                "titulo": "Eficiencia Operacional Moderada",
                "descripcion": f"Eficiencia del {eficiencia_operacional}% - Hay margen para mejorar procesos"
            })
        else:
            insights.append({
                "tipo": "negativo",
                "titulo": "Eficiencia Operacional Baja",
                "descripcion": f"Eficiencia del {eficiencia_operacional}% - Requiere revisión de procesos operativos"
            })
        
        # Recomendaciones REALES (mejoradas con lógica más específica)
        recomendaciones = []
        
        # 1. RECOMENDACIÓN: Optimización de costos (según severidad del margen)
        if margen_neto_porcentaje < 5:
            recomendaciones.append({
                "prioridad": "alta",
                "accion": "Optimizar costos operacionales - URGENTE",
                "descripcion": f"Margen crítico ({margen_neto_porcentaje}%). Revisar costos de camión (${cuota_camion:,}/mes) y tapas (${costo_tapa_con_iva:.2f}/unidad). Considerar renegociar contratos."
            })
        elif margen_neto_porcentaje < 10:
            recomendaciones.append({
                "prioridad": "alta",
                "accion": "Optimizar costos operacionales",
                "descripcion": f"Margen bajo ({margen_neto_porcentaje}%). Revisar costos de camión y tapas para mejorar rentabilidad"
            })
        elif margen_neto_porcentaje < 15:
            recomendaciones.append({
                "prioridad": "media",
                "accion": "Evaluar optimización de costos",
                "descripcion": f"Margen moderado ({margen_neto_porcentaje}%). Analizar oportunidades de reducción de costos sin afectar calidad"
            })
        
        # 2. RECOMENDACIÓN: Eficiencia de entregas (según ROI)
        if roi_mensual < 5:
            recomendaciones.append({
                "prioridad": "alta",
                "accion": "Mejorar eficiencia de entregas - URGENTE",
                "descripcion": f"ROI crítico ({roi_mensual}%). Optimizar rutas del camión, reducir tiempos muertos y aumentar número de entregas por ruta"
            })
        elif roi_mensual < 8:
            recomendaciones.append({
                "prioridad": "media",
                "accion": "Mejorar eficiencia de entregas",
                "descripcion": f"ROI bajo ({roi_mensual}%). Optimizar rutas del camión y reducir costos operativos"
            })
        
        # 3. RECOMENDACIÓN: Venta cruzada (según ticket promedio)
        ticket_minimo = precio_venta_bidon * 2  # $4000 (2 bidones)
        if ticket_promedio > 0 and ticket_promedio < ticket_minimo * 0.75:  # Menos de $3000
            recomendaciones.append({
                "prioridad": "alta",
                "accion": "Estrategias de venta cruzada - PRIORITARIO",
                "descripcion": f"Ticket promedio bajo (${ticket_promedio:,} vs mínimo ${ticket_minimo:,}). Implementar promociones para múltiples bidones por pedido"
            })
        elif ticket_promedio > 0 and ticket_promedio < ticket_minimo:
            recomendaciones.append({
                "prioridad": "media",
                "accion": "Estrategias de venta cruzada",
                "descripcion": f"Ticket promedio bajo (${ticket_promedio:,}). Ofrecer incentivos para pedidos de múltiples bidones"
            })
        
        # 4. RECOMENDACIÓN: Expansión de capacidad (si demanda supera capacidad)
        if total_bidones_mes > punto_equilibrio * 1.5:
            recomendaciones.append({
                "prioridad": "baja",
                "accion": "Evaluar expansión de capacidad",
                "descripcion": f"Ventas ({total_bidones_mes} bidones) superan equilibrio en 50% ({punto_equilibrio} bidones). Considerar segundo camión o más personal para crecimiento"
            })
        
        # 5. RECOMENDACIÓN: Mejora de eficiencia operacional (si es baja)
        if eficiencia_operacional < 5:
            recomendaciones.append({
                "prioridad": "alta",
                "accion": "Revisar procesos operativos",
                "descripcion": f"Eficiencia operacional baja ({eficiencia_operacional}%). Analizar flujo de trabajo, tiempos de entrega y asignación de recursos"
            })
        elif eficiencia_operacional < 10:
            recomendaciones.append({
                "prioridad": "media",
                "accion": "Optimizar procesos operativos",
                "descripcion": f"Eficiencia operacional moderada ({eficiencia_operacional}%). Identificar cuellos de botella y mejorar flujo de trabajo"
            })
        
        # 6. RECOMENDACIÓN: Si no hay recomendaciones críticas, sugerir mantener estrategia
        if len(recomendaciones) == 0 or all(r["prioridad"] != "alta" for r in recomendaciones):
            recomendaciones.append({
                "prioridad": "baja",
                "accion": "Mantener estrategia actual",
                "descripcion": "Indicadores en rango aceptable. Monitorear tendencias y mantener operación eficiente"
            })
        
        resultado = {
            "metricas_principales": {
                "ventas_mes": int(ventas_mes),
                "costos_totales": int(costos_totales),
                "margen_bruto": int(margen_bruto),
                "margen_neto": int(margen_neto),
                "margen_bruto_porcentaje": margen_bruto_porcentaje,
                "margen_neto_porcentaje": margen_neto_porcentaje
            },
            "analisis_financiero": {
                "punto_equilibrio": int(punto_equilibrio * precio_venta_bidon),
                "roi_mensual": roi_mensual,
                "eficiencia_operacional": eficiencia_operacional,
                "crecimiento_ventas": crecimiento_ventas
            },
            "analisis_por_cliente": {
                "clientes_unicos": clientes_unicos,
                "ticket_promedio": ticket_promedio,
                "margen_por_cliente": margen_por_cliente
            },
            "desglose_costos": {
                "costos_variables": int(costos_variables),
                "costos_fijos": int(costos_fijos),
                "porcentaje_variables": round((costos_variables / costos_totales) * 100, 1) if costos_totales > 0 else 0,
                "porcentaje_fijos": round((costos_fijos / costos_totales) * 100, 1) if costos_totales > 0 else 0
            },
            "datos_reales": {
                "precio_venta_bidon": precio_venta_bidon,
                "costo_tapa": costo_tapa,
                "costo_tapa_con_iva": round(costo_tapa_con_iva, 2),
                "cuota_camion": cuota_camion,
                "total_bidones_mes": int(total_bidones_mes),
                "punto_equilibrio_bidones": punto_equilibrio,
                "iva_neto": int(iva)
            },
            "analisis_avanzado": {
                "crecimiento": {
                    "mensual": crecimiento_mensual,
                    "trimestral": crecimiento_trimestral,
                    "ventas_trimestre": int(ventas_trimestre),
                    "ventas_trimestre_anterior": int(ventas_trimestre_anterior)
                },
                "estacionalidad": {
                    "factor_estacional": factor_estacional,
                    "promedio_verano": int(promedio_verano),
                    "promedio_invierno": int(promedio_invierno),
                    "ventas_verano": int(ventas_verano),
                    "ventas_invierno": int(ventas_invierno)
                },
                "ventas_por_zona": ventas_por_zona,
                "proyecciones": {
                    "mes_1": proyeccion_mes_1,
                    "mes_2": proyeccion_mes_2,
                    "mes_3": proyeccion_mes_3,
                    "tendencia_mensual": round(tendencia_mensual * 100, 1)
                },
                "punto_equilibrio_dinamico": {
                    "optimista": punto_equilibrio_optimista,
                    "pesimista": punto_equilibrio_pesimista,
                    "actual": punto_equilibrio
                },
                "roi": {
                    "actual": roi_mensual,
                    "proyectado": round(roi_mensual * 1.1, 1),
                    "ventas_trimestre": int(ventas_trimestre)
                },
                "escenarios_rentabilidad": {
                    "optimista": {
                        "ventas": ventas_optimista,
                        "utilidad": utilidad_optimista,
                        "margen": margen_optimista
                    },
                    "actual": {
                        "ventas": int(ventas_mes),
                        "utilidad": int(margen_neto),
                        "margen": margen_neto_porcentaje
                    },
                    "pesimista": {
                        "ventas": ventas_pesimista,
                        "utilidad": utilidad_pesimista,
                        "margen": margen_pesimista
                    }
                }
            },
            "insights": insights,
            "recomendaciones": recomendaciones,
            "fecha_analisis": hoy.isoformat()
        }
        
        print("=== ANÁLISIS DE RENTABILIDAD REAL ===")
        print(f"Ventas del mes: ${int(ventas_mes):,}")
        print(f"Costos variables: ${int(costos_variables):,}")
        print(f"Costos fijos: ${int(costos_fijos):,}")
        print(f"Margen neto: {margen_neto_porcentaje}%")
        print(f"ROI: {roi_mensual}%")
        print(f"Punto equilibrio: ${int(punto_equilibrio * precio_venta_bidon):,}")
        print(f"Bidones para equilibrio: {punto_equilibrio}")
        print("=====================================")
        
        return resultado
        
    except Exception as e:
        print(f"Error en análisis de rentabilidad: {e}")
        return {"error": f"Error en análisis: {str(e)}"}

@app.get("/ventas-locales", response_model=Dict)
def get_ventas_locales():
    """Obtener datos de ventas del local físico (retirolocal = 'si')"""
    try:
        print("Obteniendo datos de ventas locales...")
        pedidos = data_adapter.obtener_pedidos_combinados()
        print(f"Pedidos combinados obtenidos: {len(pedidos)} registros")
        
        df = pd.DataFrame(pedidos)

        # Filtrar solo pedidos de Aguas Ancud
        if 'nombrelocal' in df.columns:
            df = df[df['nombrelocal'].str.strip().str.lower() == 'aguas ancud']

        # Ventas del local físico: pedidos marcados retirolocal='si' (en el sistema
        # nuevo corresponde a deliveryType 'local' o 'retiro', distinto de 'domicilio').
        # Antes este endpoint reutilizaba TODOS los pedidos (incluido delivery) como si
        # fueran ventas del local — quedaba mezclado con /kpis y /pedidos.
        if 'retirolocal' in df.columns:
            df_local = df[df['retirolocal'].astype(str).str.strip().str.lower() == 'si'].copy()
        else:
            df_local = df.iloc[0:0].copy()
        logger.info(f"Pedidos del local físico (retirolocal='si'): {len(df_local)} de {len(df)} pedidos totales")
        
        if df_local.empty:
            return {
                "ventas_totales": 0,
                "ventas_mes": 0,
                "ventas_semana": 0,
                "ventas_hoy": 0,
                "bidones_totales": 0,
                "bidones_mes": 0,
                "bidones_semana": 0,
                "bidones_hoy": 0,
                "ticket_promedio": 0,
                "ventas_mes_pasado": 0,
                "bidones_mes_pasado": 0,
                "ticket_promedio_mes_pasado": 0,
                "total_transacciones_mes_pasado": 0,
                "metodos_pago": {},
                "ventas_diarias": [],
                "ventas_semanales": [],
                "ventas_mensuales": [],
                "total_transacciones": 0,
                "clientes_unicos": 0
            }

        # Convertir fechas y precios
        df_local['fecha_parsed'] = df_local['fecha'].apply(parse_fecha)
        df_local = df_local.dropna(subset=['fecha_parsed'])
        df_local['precio'] = pd.to_numeric(df_local['precio'], errors='coerce').fillna(0)
        
        # Fechas de referencia
        hoy = datetime.now().date()
        inicio_mes = hoy.replace(day=1)
        inicio_semana = hoy - timedelta(days=hoy.weekday())
        
        inicio_mes_pasado = (inicio_mes - timedelta(days=1)).replace(day=1)
        fin_mes_pasado = inicio_mes - timedelta(days=1)

        # Filtrar datos por períodos
        df_mes = df_local[df_local['fecha_parsed'].dt.date >= inicio_mes]
        df_semana = df_local[df_local['fecha_parsed'].dt.date >= inicio_semana]
        df_hoy = df_local[df_local['fecha_parsed'].dt.date == hoy]
        df_mes_pasado = df_local[
            (df_local['fecha_parsed'].dt.date >= inicio_mes_pasado) &
            (df_local['fecha_parsed'].dt.date <= fin_mes_pasado)
        ]

        # Calcular métricas
        ventas_totales = df_local['precio'].sum()
        ventas_mes = df_mes['precio'].sum()
        ventas_semana = df_semana['precio'].sum()
        ventas_hoy = df_hoy['precio'].sum()
        ventas_mes_pasado = df_mes_pasado['precio'].sum()

        # Calcular bidones
        bidones_totales = df_local['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
        bidones_mes = df_mes['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
        bidones_semana = df_semana['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
        bidones_hoy = df_hoy['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
        bidones_mes_pasado = df_mes_pasado['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum() if len(df_mes_pasado) > 0 else 0

        # Ticket promedio
        ticket_promedio = df_local['precio'].mean() if len(df_local) > 0 else 0
        ticket_promedio_mes_pasado = df_mes_pasado['precio'].mean() if len(df_mes_pasado) > 0 else 0
        
        # Métodos de pago
        metodos_pago = df_local['metodopago'].value_counts().to_dict()
        
        # Ventas diarias (últimos 7 días)
        ventas_diarias = []
        for i in range(7):
            fecha = hoy - timedelta(days=6-i)
            ventas_dia = df_local[df_local['fecha_parsed'].dt.date == fecha]['precio'].sum()
            bidones_dia = df_local[df_local['fecha_parsed'].dt.date == fecha]['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
            ventas_diarias.append({
                'fecha': fecha.strftime('%Y-%m-%d'),
                'ventas': int(ventas_dia),
                'bidones': int(bidones_dia)
            })
        
        # Ventas semanales (últimas 4 semanas)
        ventas_semanales = []
        for i in range(4):
            inicio_sem = hoy - timedelta(days=(hoy.weekday() + 7*i))
            fin_sem = inicio_sem + timedelta(days=6)
            ventas_sem = df_local[
                (df_local['fecha_parsed'].dt.date >= inicio_sem) & 
                (df_local['fecha_parsed'].dt.date <= fin_sem)
            ]['precio'].sum()
            bidones_sem = df_local[
                (df_local['fecha_parsed'].dt.date >= inicio_sem) & 
                (df_local['fecha_parsed'].dt.date <= fin_sem)
            ]['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
            ventas_semanales.append({
                'semana': f"Sem {4-i}",
                'ventas': int(ventas_sem),
                'bidones': int(bidones_sem)
            })
        
        # Ventas mensuales (últimos 6 meses)
        ventas_mensuales = []
        for i in range(6):
            fecha_mes = hoy.replace(day=1) - timedelta(days=30*i)
            inicio_mes_calc = fecha_mes.replace(day=1)
            fin_mes_calc = (inicio_mes_calc + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            ventas_mes_calc = df_local[
                (df_local['fecha_parsed'].dt.date >= inicio_mes_calc) & 
                (df_local['fecha_parsed'].dt.date <= fin_mes_calc)
            ]['precio'].sum()
            bidones_mes_calc = df_local[
                (df_local['fecha_parsed'].dt.date >= inicio_mes_calc) & 
                (df_local['fecha_parsed'].dt.date <= fin_mes_calc)
            ]['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
            ventas_mensuales.append({
                'mes': fecha_mes.strftime('%b'),
                'ventas': int(ventas_mes_calc),
                'bidones': int(bidones_mes_calc)
            })
        
        return {
            "ventas_totales": int(ventas_totales),
            "ventas_mes": int(ventas_mes),
            "ventas_semana": int(ventas_semana),
            "ventas_hoy": int(ventas_hoy),
            "bidones_totales": int(bidones_totales),
            "bidones_mes": int(bidones_mes),
            "bidones_semana": int(bidones_semana),
            "bidones_hoy": int(bidones_hoy),
            "ticket_promedio": int(ticket_promedio),
            "ventas_mes_pasado": int(ventas_mes_pasado),
            "bidones_mes_pasado": int(bidones_mes_pasado),
            "ticket_promedio_mes_pasado": int(ticket_promedio_mes_pasado),
            "total_transacciones_mes_pasado": len(df_mes_pasado),
            "metodos_pago": metodos_pago,
            "ventas_diarias": ventas_diarias,
            "ventas_semanales": ventas_semanales,
            "ventas_mensuales": ventas_mensuales,
            "total_transacciones": len(df_local),
            "clientes_unicos": len(df_local['usuario'].unique()) if 'usuario' in df_local.columns else 0
        }
        
    except Exception as e:
        print(f"Error obteniendo ventas locales: {e}")
        return {
            "ventas_totales": 0,
            "ventas_mes": 0,
            "ventas_semana": 0,
            "ventas_hoy": 0,
            "bidones_totales": 0,
            "bidones_mes": 0,
            "bidones_semana": 0,
            "bidones_hoy": 0,
            "ticket_promedio": 0,
            "ventas_mes_pasado": 0,
            "bidones_mes_pasado": 0,
            "ticket_promedio_mes_pasado": 0,
            "total_transacciones_mes_pasado": 0,
            "metodos_pago": {},
            "ventas_diarias": [],
            "ventas_semanales": [],
            "ventas_mensuales": [],
            "total_transacciones": 0,
            "clientes_unicos": 0
        }

@app.get("/test")
def test_endpoint():
    return {"message": "Server is working", "ventas_hoy": 22000}

@app.get("/health")
def health_check():
    """Endpoint de health check para monitoreo"""
    try:
        # Verificar conexión a APIs externas
        test_clientes = requests.get(ENDPOINT_CLIENTES, headers=HEADERS, timeout=5)
        test_pedidos = requests.get(ENDPOINT_PEDIDOS, headers=HEADERS, timeout=5)
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "services": {
                "api_clientes": "ok" if test_clientes.status_code == 200 else "degraded",
                "api_pedidos": "ok" if test_pedidos.status_code == 200 else "degraded"
            },
            "version": "2.0"
        }
    except Exception as e:
        logger.warning(f"Health check con problemas: {e}")
        return {
            "status": "degraded",
            "timestamp": datetime.now().isoformat(),
            "error": str(e),
            "version": "2.0"
        }

@app.get("/ventas-locales-test", response_model=Dict)
def get_ventas_locales_test():
    """Endpoint de prueba para ventas locales"""
    return {
        "ventas_totales": 156000,
        "ventas_mes": 45000,
        "ventas_semana": 12000,
        "ventas_hoy": 2000,
        "bidones_totales": 78,
        "bidones_mes": 22,
        "bidones_semana": 6,
        "bidones_hoy": 1,
        "ticket_promedio": 2000,
        "metodos_pago": {"efectivo": 15, "transferencia": 8, "tarjeta": 3},
        "ventas_diarias": [],
        "ventas_semanales": [],
        "ventas_mensuales": [],
        "total_transacciones": 26,
        "clientes_unicos": 15
    }

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

    # Días calendario que faltan en el mes actual (incluyendo hoy), para que
    # la proyección de fin de mes cubra el mes completo y no solo 7 días.
    hoy = datetime.now().date()
    ultimo_dia_mes = calendar.monthrange(hoy.year, hoy.month)[1]
    dias_restantes = (date(hoy.year, hoy.month, ultimo_dia_mes) - hoy).days
    horizonte = max(7, dias_restantes)

    dias_horizonte = demand_forecast_service.predecir_proximos_dias(pedidos_filtrados, dias=horizonte)
    validacion = demand_forecast_service.validar_precision(pedidos_filtrados, dias_test=30)

    # El chart operativo de 7 días siempre usa exactamente los primeros 7
    # días del mismo horizonte pronosticado (evita entrenar el modelo dos veces).
    dias_7 = dias_horizonte[:7]

    if not dias_7:
        return {
            "dias_7": [], "manana": None, "proyeccion_mes": None,
            "precision_historica_pct": validacion['mape_pct'],
            "dias_evaluados": validacion['dias_evaluados'],
        }

    manana = dias_7[0]

    # Proyección de fin de mes: ventas reales ya ocurridas este mes +
    # la suma de las predicciones diarias para los días restantes del mes
    # (no solo los que caben en el horizonte de 7 días del chart operativo).
    inicio_mes = hoy.replace(day=1)
    df['fecha_dt'] = df['fecha'].apply(lambda f: pd.to_datetime(f, format='%d-%m-%Y', errors='coerce'))
    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)
    ventas_mes_actual = float(df[df['fecha_dt'].dt.date >= inicio_mes]['precio_num'].sum())
    ticket_promedio = float(df['precio_num'].mean()) if len(df) else 2000.0

    dias_restantes_mes = [d for d in dias_horizonte if datetime.strptime(d['fecha'], '%Y-%m-%d').date().month == hoy.month]
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

# Servir frontend estático (debe ir al final, después de todas las rutas API)
_BASE = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.normpath(os.path.join(_BASE, "..", "frontend", "dist"))
logger.info(f"Frontend dist path: {FRONTEND_DIST} — exists: {os.path.exists(FRONTEND_DIST)}")

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    async def serve_root():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001) 