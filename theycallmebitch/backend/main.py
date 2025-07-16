from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
import pandas as pd
from typing import List, Dict
from datetime import datetime

app = FastAPI(title="Aguas Ancud API", description="Backend para dashboard de Aguas Ancud")

# Configuración de CORS para desarrollo y producción
import os

# Obtener origen permitido desde variable de entorno o usar valor por defecto
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ENDPOINT_CLIENTES = "https://fluvi.cl/fluviDos/GoApp/endpoints/clientes.php"
ENDPOINT_PEDIDOS = "https://fluvi.cl/fluviDos/GoApp/endpoints/pedidos.php"
HEADERS = {"User-Agent": "Mozilla/5.0"}

def parse_fecha(fecha_str):
    """Convierte fecha del formato DD-MM-YYYY a datetime"""
    try:
        return datetime.strptime(fecha_str, "%d-%m-%Y")
    except:
        return None

@app.get("/pedidos", response_model=List[Dict])
def get_pedidos():
    """Obtener pedidos filtrados solo de Aguas Ancud"""
    try:
        response = requests.get(ENDPOINT_PEDIDOS, headers=HEADERS, timeout=10)
        print("Respuesta pedidos:", response.text[:500])  # Solo los primeros 500 caracteres
        response.raise_for_status()
        try:
            pedidos = response.json()
        except Exception as e:
            print("Error al parsear JSON de pedidos:", e)
            raise HTTPException(status_code=502, detail="Respuesta de pedidos no es JSON válido")
    except Exception as e:
        print("Error al obtener pedidos:", e)
        raise HTTPException(status_code=502, detail=f"No se pudo conectar al servidor externo de pedidos: {e}")
    
    df = pd.DataFrame(pedidos)
    print(f"Total de pedidos antes del filtro: {len(df)}")
    
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'] == 'Aguas Ancud']
        print(f"Pedidos después del filtro Aguas Ancud: {len(df)}")
        print(f"Locales únicos en los datos: {df['nombrelocal'].unique()}")
    
    # Convertir fechas y agregar columna cliente
    if 'fecha' in df.columns:
        df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
        df['fecha_iso'] = df['fecha_parsed'].apply(lambda x: x.isoformat() if x else None)
    
    # Agregar columna cliente basada en usuario
    if 'usuario' in df.columns:
        df['cliente'] = df['usuario']
    
    return df.to_dict(orient='records')

@app.get("/clientes", response_model=List[Dict])
def get_clientes():
    """Obtener clientes únicos de Aguas Ancud a partir de los pedidos, incluyendo monto del último pedido"""
    try:
        response = requests.get(ENDPOINT_PEDIDOS, headers=HEADERS, timeout=10)
        response.raise_for_status()
        pedidos = response.json()
    except Exception as e:
        print("Error al obtener pedidos para clientes:", e)
        return []
    df = pd.DataFrame(pedidos)
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].str.strip().str.lower() == 'aguas ancud']
    if df.empty or 'usuario' not in df.columns:
        return []
    df['precio'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)
    # Seleccionar el último pedido por usuario
    df['fecha_dt'] = pd.to_datetime(df['fecha'], format='%d-%m-%Y', errors='coerce')
    df = df.sort_values('fecha_dt', ascending=False)
    clientes = df.drop_duplicates('usuario', keep='first')
    # Construir la lista de clientes con monto del último pedido
    cols = ['usuario', 'telefonou', 'dire', 'fecha', 'status', 'precio']
    clientes = clientes[cols].rename(columns={'precio': 'monto_ultimo_pedido'}).to_dict(orient='records')
    return clientes

@app.get("/kpis", response_model=Dict)
def get_kpis():
    """Calcular KPIs principales de Aguas Ancud"""
    print("=== INICIO ENDPOINT KPIs ===")
    try:
        print("Intentando obtener pedidos desde:", ENDPOINT_PEDIDOS)
        response = requests.get(ENDPOINT_PEDIDOS, headers=HEADERS, timeout=10)
        print(f"Status code: {response.status_code}")
        response.raise_for_status()
        try:
            pedidos = response.json()
            print(f"Pedidos obtenidos: {len(pedidos)} registros")
        except Exception as e:
            print("Error al parsear JSON de KPIs:", e)
            print("Respuesta recibida:", response.text[:200])
            return {
                "ventas_mes": 0,
                "ventas_mes_pasado": 0,
                "total_pedidos_mes": 0,
                "total_pedidos_mes_pasado": 0,
                "total_litros_mes": 0,
                "costos_reales": 0,
                "iva": 0,
                "punto_equilibrio": 0,
                "clientes_activos": 0,
            }
    except Exception as e:
        print("Error al obtener pedidos para KPIs:", e)
        return {
            "ventas_mes": 0,
            "ventas_mes_pasado": 0,
            "total_pedidos_mes": 0,
            "total_pedidos_mes_pasado": 0,
            "total_litros_mes": 0,
            "costos_reales": 0,
            "iva": 0,
            "punto_equilibrio": 0,
            "clientes_activos": 0,
        }
    
    df = pd.DataFrame(pedidos)
    print(f"Total de pedidos para KPIs antes del filtro: {len(df)}")
    print(f"Columnas disponibles: {list(df.columns)}")
    
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'] == 'Aguas Ancud']
        print(f"Pedidos para KPIs después del filtro Aguas Ancud: {len(df)}")
        print(f"Locales únicos en KPIs: {df['nombrelocal'].unique()}")
    else:
        print("ADVERTENCIA: No se encontró columna 'nombrelocal'")
    
    if df.empty or 'fecha' not in df.columns:
        print("DataFrame vacío o sin columna fecha")
        return {
            "ventas_mes": 0,
            "ventas_mes_pasado": 0,
            "total_pedidos_mes": 0,
            "total_pedidos_mes_pasado": 0,
            "total_litros_mes": 0,
            "costos_reales": 0,
            "iva": 0,
            "punto_equilibrio": 0,
            "clientes_activos": 0,
        }
    
    try:
        # Convertir fechas correctamente
        df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
        df = df.dropna(subset=['fecha_parsed'])
        print(f"Pedidos con fechas válidas: {len(df)}")
        
        # Convertir precios
        df['precio'] = pd.to_numeric(df['precio'], errors='coerce').fillna(0)
        df['cantidad'] = df['precio'] // 2000
        
        # Agregar columna cliente basada en usuario
        if 'usuario' in df.columns:
            df['cliente'] = df['usuario']
        
        # Calcular fechas para filtros
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
        
        # Filtrar pedidos por mes
        pedidos_mes = df[(df['fecha_parsed'].dt.month == mes_actual) & (df['fecha_parsed'].dt.year == anio_actual)]
        pedidos_mes_pasado = df[(df['fecha_parsed'].dt.month == mes_pasado) & (df['fecha_parsed'].dt.year == anio_pasado)]
        
        print(f"Pedidos mes actual: {len(pedidos_mes)}")
        print(f"Pedidos mes pasado: {len(pedidos_mes_pasado)}")
        
        # Calcular KPIs
        ventas_mes = pedidos_mes['precio'].sum()
        ventas_mes_pasado = pedidos_mes_pasado['precio'].sum()
        total_bidones_mes = pedidos_mes['cantidad'].sum()
        
        # Cálculo de costos según especificaciones
        cuota_camion = 260000  # Costo fijo mensual del camión
        costo_tapa = 51  # Costo por tapa (sin IVA)
        precio_venta_bidon = 2000
        
        # Costo por bidón: 1 tapa + IVA
        costo_tapa_con_iva = costo_tapa * 1.19  # 51 + 19% IVA = 60.69 pesos
        costos_variables = costo_tapa_con_iva * total_bidones_mes  # Costos por bidones vendidos
        costos_reales = cuota_camion + costos_variables  # Costos fijos + variables
        
        # Cálculo de IVA
        iva_ventas = ventas_mes * 0.19  # IVA de las ventas
        iva_tapas = (costo_tapa * total_bidones_mes) * 0.19  # IVA de las tapas compradas
        iva = iva_ventas - iva_tapas  # IVA neto a pagar
        
        # Cálculo de utilidad: Ventas - Costos (sin restar IVA, ya que los costos ya incluyen IVA)
        utilidad = ventas_mes - costos_reales
        
        # Cálculo punto de equilibrio
        try:
            # Punto de equilibrio: cuota camión / (precio venta - costo por bidón con IVA)
            punto_equilibrio = int(round(cuota_camion / (precio_venta_bidon - costo_tapa_con_iva)))
        except ZeroDivisionError:
            punto_equilibrio = 0
        
        # Cálculo de capacidad utilizada
        capacidad_total_litros = 30000  # 30.000 litros por mes
        litros_vendidos = total_bidones_mes * 20  # Cada bidón = 20 litros
        capacidad_utilizada_porcentaje = min(100, (litros_vendidos / capacidad_total_litros) * 100)
        
        # Cálculo clientes activos últimos 2 meses
        clientes_ultimos_2m = pd.concat([pedidos_mes, pedidos_mes_pasado])
        clientes_activos = len(clientes_ultimos_2m['usuario'].unique()) if 'usuario' in clientes_ultimos_2m.columns else 0
        
        resultado = {
            "ventas_mes": int(ventas_mes),
            "ventas_mes_pasado": int(ventas_mes_pasado),
            "total_pedidos_mes": len(pedidos_mes),
            "total_pedidos_mes_pasado": len(pedidos_mes_pasado),
            "total_litros_mes": int(total_bidones_mes * 20),
            "costos_reales": int(costos_reales),
            "iva": int(iva),
            "utilidad": int(utilidad),
            "punto_equilibrio": punto_equilibrio,
            "clientes_activos": clientes_activos,
            "capacidad_utilizada": round(capacidad_utilizada_porcentaje, 1),
            "litros_vendidos": int(litros_vendidos),
            "capacidad_total": capacidad_total_litros,
        }
        
        print("=== RESULTADO KPIs ===")
        print(resultado)
        print("=== FIN ENDPOINT KPIs ===")
        return resultado
        
    except Exception as e:
        print(f"Error en cálculo de KPIs: {e}")
        return {
            "ventas_mes": 0,
            "ventas_mes_pasado": 0,
            "total_pedidos_mes": 0,
            "total_pedidos_mes_pasado": 0,
            "total_litros_mes": 0,
            "costos_reales": 0,
            "iva": 0,
            "punto_equilibrio": 0,
            "clientes_activos": 0,
        } 

@app.get("/clientes_vip", response_model=Dict)
def get_clientes_vip():
    """Devuelve los 15 clientes que más dinero han aportado y los 15 con mayor frecuencia de compra (solo Aguas Ancud)"""
    try:
        response = requests.get(ENDPOINT_PEDIDOS, headers=HEADERS, timeout=10)
        response.raise_for_status()
        pedidos = response.json()
    except Exception as e:
        print("Error al obtener pedidos para clientes VIP:", e)
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
def get_heatmap(mes: int = Query(None), anio: int = Query(None)):
    """Devuelve coordenadas de pedidos de Aguas Ancud para el heatmap"""
    try:
        pedidos_resp = requests.get(ENDPOINT_PEDIDOS, headers=HEADERS, timeout=10)
        pedidos_resp.raise_for_status()
        pedidos = pedidos_resp.json()
    except Exception as e:
        print("Error al obtener pedidos para heatmap:", e)
        return []
    
    df_pedidos = pd.DataFrame(pedidos)
    print(f"Pedidos totales: {len(df_pedidos)}")
    
    if 'nombrelocal' in df_pedidos.columns:
        df_pedidos = df_pedidos[df_pedidos['nombrelocal'].str.strip().str.lower() == 'aguas ancud']
    print(f"Pedidos Aguas Ancud: {len(df_pedidos)}")
    
    # Solo aplicar filtro de mes/año si se proporcionan ambos parámetros
    if mes is not None and anio is not None:
        df_pedidos['fecha_dt'] = pd.to_datetime(df_pedidos['fecha'], format='%d-%m-%Y', errors='coerce')
        df_pedidos = df_pedidos[(df_pedidos['fecha_dt'].dt.month == mes) & (df_pedidos['fecha_dt'].dt.year == anio)]
        print(f"Pedidos tras filtro mes/año ({mes}/{anio}): {len(df_pedidos)}")
    else:
        print("No se aplicó filtro de mes/año - mostrando todos los datos disponibles")
    
    if df_pedidos.empty:
        print("No hay pedidos después del filtro")
        return []
    
    # Verificar si hay columnas de coordenadas
    coord_columns = [col for col in df_pedidos.columns if 'lat' in col.lower() or 'lon' in col.lower() or 'lng' in col.lower()]
    print(f"Columnas de coordenadas encontradas: {coord_columns}")
    
    # Si no hay coordenadas reales, generar basadas en dirección
    if not coord_columns or df_pedidos[coord_columns].isnull().all().all():
        print("No hay coordenadas reales, generando basadas en dirección...")
        
        if 'dire' in df_pedidos.columns:
            # Agrupar por dirección y contar pedidos
            df_pedidos['dire_norm'] = df_pedidos['dire'].str.strip().str.lower()
            direcciones_unicas = df_pedidos.groupby('dire_norm').agg({
                'usuario': 'first',
                'telefonou': 'first',
                'precio': 'sum'
            }).reset_index()
            
            print(f"Direcciones únicas encontradas: {len(direcciones_unicas)}")
            
            # Generar coordenadas basadas en hash de dirección
            def generate_coordinates_from_address(address):
                if pd.isna(address) or address == '':
                    return None
                
                # Hash simple de la dirección
                hash_val = sum(ord(c) for c in str(address))
                
                # Coordenadas base en Puente Alto, Santiago
                base_lat = -33.6167
                base_lng = -70.5833
                
                # Variación basada en hash (más pequeña para mantener en la zona)
                lat_variation = (hash_val % 1000) / 50000  # ±0.02 grados
                lng_variation = ((hash_val * 2) % 1000) / 50000  # ±0.02 grados
                
                return {
                    'lat': base_lat + lat_variation,
                    'lng': base_lng + lng_variation
                }
            
            # Generar coordenadas para cada dirección única
            heatmap_data = []
            for _, row in direcciones_unicas.iterrows():
                coords = generate_coordinates_from_address(row['dire_norm'])
                if coords:
                    heatmap_data.append({
                        'lat': coords['lat'],
                        'lon': coords['lng'],
                        'address': row['dire_norm'],
                        'user': row['usuario'],
                        'phone': row['telefonou'],
                        'total_spent': row['precio']
                    })
            
            print(f"Puntos de calor generados: {len(heatmap_data)}")
            return heatmap_data
        else:
            print("No se encontró columna 'dire' en los pedidos")
            return []
    else:
        # Usar coordenadas reales
        print("Usando coordenadas reales de los pedidos...")
        
        # Identificar columnas de lat y lon
        lat_col = None
        lon_col = None
        
        for col in df_pedidos.columns:
            if 'lat' in col.lower():
                lat_col = col
            elif 'lon' in col.lower() or 'lng' in col.lower():
                lon_col = col
        
        if lat_col and lon_col:
            # Filtrar pedidos con coordenadas válidas
            df_coords = df_pedidos[df_pedidos[lat_col].notnull() & df_pedidos[lon_col].notnull()]
            print(f"Pedidos con coordenadas válidas: {len(df_coords)}")
            
            heatmap_data = []
            for _, row in df_coords.iterrows():
                try:
                    lat = float(row[lat_col])
                    lon = float(row[lon_col])
                    
                    heatmap_data.append({
                        'lat': lat,
                        'lon': lon,
                        'address': row.get('dire', 'Sin dirección'),
                        'user': row.get('usuario', 'Sin usuario'),
                        'phone': row.get('telefonou', 'Sin teléfono'),
                        'total_spent': row.get('precio', 0)
                    })
                except (ValueError, TypeError):
                    continue
            
            print(f"Puntos de calor con coordenadas reales: {len(heatmap_data)}")
            return heatmap_data
        else:
            print("No se encontraron columnas de lat/lon válidas")
            return []

@app.get("/factores-prediccion", response_model=Dict)
def get_factores_prediccion():
    """Calcular factores de predicción basados en datos históricos reales"""
    try:
        response = requests.get(ENDPOINT_PEDIDOS, headers=HEADERS, timeout=10)
        response.raise_for_status()
        pedidos = response.json()
    except Exception as e:
        print("Error al obtener pedidos para factores:", e)
        return {}
    
    df = pd.DataFrame(pedidos)
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'] == 'Aguas Ancud']
    
    if df.empty or 'fecha' not in df.columns:
        return {}
    
    # Convertir fechas
    df['fecha_parsed'] = df['fecha'].apply(parse_fecha)
    df = df.dropna(subset=['fecha_parsed'])
    
    # Agregar columnas para análisis
    df['mes'] = df['fecha_parsed'].dt.month
    df['dia_semana'] = df['fecha_parsed'].dt.dayofweek  # 0=lunes, 6=domingo
    df['anio'] = df['fecha_parsed'].dt.year
    
    # 1. FACTOR TEMPORADA - Análisis por mes
    pedidos_por_mes = df.groupby('mes')['precio'].count()
    promedio_mensual = pedidos_por_mes.mean()
    factores_temporada = {}
    for mes in range(1, 13):
        if mes in pedidos_por_mes.index:
            factor = pedidos_por_mes[mes] / promedio_mensual
            factores_temporada[mes-1] = round(factor, 2)  # mes-1 porque JavaScript usa 0-11
        else:
            factores_temporada[mes-1] = 1.0
    
    # 2. FACTOR ZONA - Análisis por dirección
    def extraer_zona(direccion):
        if not direccion or pd.isna(direccion):
            return 'otro'
        direccion_lower = str(direccion).lower()
        if any(palabra in direccion_lower for palabra in ['centro', 'plaza', 'downtown']):
            return 'centro'
        elif any(palabra in direccion_lower for palabra in ['norte', 'north', 'arriba']):
            return 'norte'
        elif any(palabra in direccion_lower for palabra in ['sur', 'south', 'abajo']):
            return 'sur'
        elif any(palabra in direccion_lower for palabra in ['este', 'east', 'derecha']):
            return 'este'
        elif any(palabra in direccion_lower for palabra in ['oeste', 'west', 'izquierda']):
            return 'oeste'
        else:
            return 'otro'
    
    df['zona'] = df['dire'].apply(extraer_zona)
    pedidos_por_zona = df.groupby('zona')['precio'].count()
    promedio_por_zona = pedidos_por_zona.mean()
    factores_zona = {}
    for zona in ['centro', 'norte', 'sur', 'este', 'oeste', 'otro']:
        if zona in pedidos_por_zona.index:
            factor = pedidos_por_zona[zona] / promedio_por_zona
            factores_zona[zona] = round(factor, 2)
        else:
            factores_zona[zona] = 1.0
    
    # 3. FACTOR TIPO CLIENTE - Análisis por recurrencia
    pedidos_por_cliente = df.groupby('usuario').size()
    promedio_pedidos_cliente = pedidos_por_cliente.mean()
    
    def clasificar_tipo_cliente(num_pedidos):
        if num_pedidos >= promedio_pedidos_cliente * 1.5:
            return 'recurrente'
        elif num_pedidos >= promedio_pedidos_cliente * 0.8:
            return 'residencial'
        elif num_pedidos >= promedio_pedidos_cliente * 0.5:
            return 'nuevo'
        else:
            return 'empresa'  # Clientes con pocos pedidos pero de alto valor
    
    df['tipo_cliente'] = df['usuario'].map(pedidos_por_cliente).apply(clasificar_tipo_cliente)
    pedidos_por_tipo = df.groupby('tipo_cliente')['precio'].count()
    promedio_por_tipo = pedidos_por_tipo.mean()
    factores_tipo_cliente = {}
    for tipo in ['recurrente', 'residencial', 'nuevo', 'empresa']:
        if tipo in pedidos_por_tipo.index:
            factor = pedidos_por_tipo[tipo] / promedio_por_tipo
            factores_tipo_cliente[tipo] = round(factor, 2)
        else:
            factores_tipo_cliente[tipo] = 1.0
    
    # 4. FACTOR DÍA SEMANA - Análisis por día
    pedidos_por_dia = df.groupby('dia_semana')['precio'].count()
    promedio_por_dia = pedidos_por_dia.mean()
    factores_dia_semana = {}
    for dia in range(7):
        if dia in pedidos_por_dia.index:
            factor = pedidos_por_dia[dia] / promedio_por_dia
            factores_dia_semana[dia] = round(factor, 2)
        else:
            factores_dia_semana[dia] = 1.0
    
    # 5. FACTOR TENDENCIA - Crecimiento mensual
    pedidos_por_mes_anio = df.groupby(['anio', 'mes'])['precio'].count()
    if len(pedidos_por_mes_anio) >= 2:
        # Calcular crecimiento promedio mensual
        valores = list(pedidos_por_mes_anio.values)
        crecimiento_mensual = 1.0
        for i in range(1, len(valores)):
            if valores[i-1] > 0:
                crecimiento = valores[i] / valores[i-1]
                crecimiento_mensual *= crecimiento
        crecimiento_mensual = crecimiento_mensual ** (1.0 / (len(valores) - 1))
    else:
        crecimiento_mensual = 1.05  # 5% por defecto
    
    return {
        "factores_temporada": factores_temporada,
        "factores_zona": factores_zona,
        "factores_tipo_cliente": factores_tipo_cliente,
        "factores_dia_semana": factores_dia_semana,
        "crecimiento_mensual": round(crecimiento_mensual, 3),
        "promedio_pedidos_mensual": int(promedio_mensual),
        "total_pedidos_analizados": len(df),
        "periodo_analisis": {
            "fecha_inicio": df['fecha_parsed'].min().strftime('%Y-%m-%d'),
            "fecha_fin": df['fecha_parsed'].max().strftime('%Y-%m-%d')
        }
    }

@app.get("/ventas-totales-historicas", response_model=Dict)
def get_ventas_totales_historicas():
    """Obtener ventas totales históricas acumuladas"""
    try:
        response = requests.get(ENDPOINT_PEDIDOS, headers=HEADERS, timeout=10)
        response.raise_for_status()
        pedidos = response.json()
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
    """Obtener datos históricos de ventas para gráficos"""
    try:
        response = requests.get(ENDPOINT_PEDIDOS, headers=HEADERS, timeout=10)
        response.raise_for_status()
        pedidos = response.json()
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
        
        # Agrupar por mes y año
        df['mes_anio'] = df['fecha_parsed'].dt.to_period('M')
        ventas_por_mes = df.groupby('mes_anio')['precio'].sum().reset_index()
        
        # Convertir a formato requerido por el gráfico
        resultado = []
        for _, row in ventas_por_mes.iterrows():
            mes_anio = row['mes_anio']
            nombre_mes = mes_anio.strftime('%b')  # Abr, May, Jun, etc.
            resultado.append({
                'name': nombre_mes,
                'ventas': int(row['precio'])
            })
        
        return resultado
        
    except Exception as e:
        print(f"Error procesando ventas históricas: {e}")
        return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 