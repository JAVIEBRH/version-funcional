#!/usr/bin/env python3
"""
Script de verificación simple de KPIs
"""

import requests
import pandas as pd
import json
from datetime import datetime

def verificar_kpis_simple():
    try:
        print("=== VERIFICACION COMPLETA DE KPIs ===")
        
        # 1. Obtener datos de KPIs del endpoint
        print("\n1. Obteniendo KPIs del endpoint...")
        response_kpis = requests.get("http://localhost:8001/kpis", timeout=30)
        kpis = response_kpis.json()
        
        # 2. Obtener datos de pedidos
        print("\n2. Obteniendo datos de pedidos...")
        response_pedidos = requests.get("http://localhost:8001/pedidos", timeout=30)
        pedidos = response_pedidos.json()
        
        # 3. Procesar datos
        df = pd.DataFrame(pedidos)
        df_ancud = df[df['nombrelocal'] == 'Aguas Ancud'].copy()
        df_ancud['fecha_parsed'] = pd.to_datetime(df_ancud['fecha'], format='%d-%m-%Y', errors='coerce')
        df_ancud['precio_numeric'] = pd.to_numeric(df_ancud['precio'], errors='coerce')
        
        # Mes actual (octubre 2025)
        mes_actual = 10
        anio_actual = 2025
        pedidos_mes_actual = df_ancud[
            (df_ancud['fecha_parsed'].dt.month == mes_actual) & 
            (df_ancud['fecha_parsed'].dt.year == anio_actual)
        ]
        
        # Mes anterior (septiembre 2025)
        mes_anterior = 9
        anio_anterior = 2025
        pedidos_mes_anterior = df_ancud[
            (df_ancud['fecha_parsed'].dt.month == mes_anterior) & 
            (df_ancud['fecha_parsed'].dt.year == anio_anterior)
        ]
        
        print(f"Pedidos mes actual (octubre): {len(pedidos_mes_actual)}")
        print(f"Pedidos mes anterior (septiembre): {len(pedidos_mes_anterior)}")
        
        # 4. Cálculos manuales
        print("\n3. Realizando calculos manuales...")
        
        # Ventas
        ventas_mes_manual = pedidos_mes_actual['precio_numeric'].sum()
        ventas_mes_pasado_manual = pedidos_mes_anterior['precio_numeric'].sum()
        
        # Bidones
        bidones_mes_manual = pedidos_mes_actual['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
        bidones_mes_pasado_manual = pedidos_mes_anterior['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum()
        
        # Litros
        litros_mes_manual = bidones_mes_manual * 20
        litros_mes_pasado_manual = bidones_mes_pasado_manual * 20
        
        # Clientes
        clientes_activos_manual = len(pedidos_mes_actual['usuario'].unique())
        clientes_activos_pasado_manual = len(pedidos_mes_anterior['usuario'].unique())
        
        # Costos
        cuota_camion = 260000
        costo_tapa = 51
        costo_tapa_con_iva = costo_tapa * 1.19  # 60.69
        costos_variables = costo_tapa_con_iva * bidones_mes_manual
        costos_reales_manual = cuota_camion + costos_variables
        
        # IVA
        iva_ventas = ventas_mes_manual * 0.19
        iva_tapas = (costo_tapa * bidones_mes_manual) * 0.19
        iva_manual = iva_ventas - iva_tapas
        
        # Utilidad
        utilidad_manual = ventas_mes_manual - costos_reales_manual
        
        # Capacidad
        capacidad_total = 30000
        capacidad_utilizada_manual = (litros_mes_manual / capacidad_total) * 100
        
        # Porcentajes de cambio
        cambio_ventas_manual = ((ventas_mes_manual - ventas_mes_pasado_manual) / ventas_mes_pasado_manual) * 100
        cambio_bidones_manual = ((bidones_mes_manual - bidones_mes_pasado_manual) / bidones_mes_pasado_manual) * 100
        
        # 5. Comparación
        print("\n4. COMPARACION: Endpoint vs Calculos Manuales")
        print("=" * 60)
        
        comparaciones = [
            ("Ventas Mes", kpis['ventas_mes'], ventas_mes_manual),
            ("Ventas Mes Pasado", kpis['ventas_mes_pasado'], ventas_mes_pasado_manual),
            ("Total Pedidos Mes", kpis['total_pedidos_mes'], len(pedidos_mes_actual)),
            ("Total Pedidos Mes Pasado", kpis['total_pedidos_mes_pasado'], len(pedidos_mes_anterior)),
            ("Total Bidones Mes", kpis['total_bidones_mes'], bidones_mes_manual),
            ("Total Bidones Mes Pasado", kpis['total_bidones_mes_pasado'], bidones_mes_pasado_manual),
            ("Total Litros Mes", kpis['total_litros_mes'], litros_mes_manual),
            ("Costos Reales", kpis['costos_reales'], costos_reales_manual),
            ("IVA", kpis['iva'], iva_manual),
            ("Utilidad", kpis['utilidad'], utilidad_manual),
            ("Clientes Activos", kpis['clientes_activos'], clientes_activos_manual),
            ("Capacidad Utilizada", kpis['capacidad_utilizada'], capacidad_utilizada_manual),
            ("Cambio Ventas %", kpis['cambio_ventas_porcentaje'], cambio_ventas_manual),
            ("Cambio Bidones %", kpis['cambio_bidones_porcentaje'], cambio_bidones_manual)
        ]
        
        for nombre, valor_endpoint, valor_manual in comparaciones:
            diferencia = abs(valor_endpoint - valor_manual)
            porcentaje_diferencia = (diferencia / valor_manual * 100) if valor_manual != 0 else 0
            status = "OK" if diferencia < 1 else "ERROR"
            print(f"{nombre:25} | Endpoint: {valor_endpoint:>10} | Manual: {valor_manual:>10} | Diff: {diferencia:>8.2f} | {status}")
        
        # 6. Guardar verificación completa
        verificacion = {
            "fecha_verificacion": datetime.now().isoformat(),
            "datos_endpoint": kpis,
            "calculos_manuales": {
                "ventas_mes": ventas_mes_manual,
                "ventas_mes_pasado": ventas_mes_pasado_manual,
                "total_pedidos_mes": len(pedidos_mes_actual),
                "total_pedidos_mes_pasado": len(pedidos_mes_anterior),
                "total_bidones_mes": bidones_mes_manual,
                "total_bidones_mes_pasado": bidones_mes_pasado_manual,
                "total_litros_mes": litros_mes_manual,
                "costos_reales": costos_reales_manual,
                "iva": iva_manual,
                "utilidad": utilidad_manual,
                "clientes_activos": clientes_activos_manual,
                "capacidad_utilizada": capacidad_utilizada_manual,
                "cambio_ventas_porcentaje": cambio_ventas_manual,
                "cambio_bidones_porcentaje": cambio_bidones_manual
            },
            "comparaciones": [
                {
                    "metrica": nombre,
                    "endpoint": valor_endpoint,
                    "manual": valor_manual,
                    "diferencia": abs(valor_endpoint - valor_manual),
                    "porcentaje_diferencia": (abs(valor_endpoint - valor_manual) / valor_manual * 100) if valor_manual != 0 else 0,
                    "coincide": abs(valor_endpoint - valor_manual) < 1
                }
                for nombre, valor_endpoint, valor_manual in comparaciones
            ]
        }
        
        with open("verificacion_completa_kpis.json", "w", encoding="utf-8") as f:
            json.dump(verificacion, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"\n5. Verificacion guardada en: verificacion_completa_kpis.json")
        
        return True
        
    except Exception as e:
        print(f"Error en verificacion: {e}")
        return False

if __name__ == "__main__":
    verificar_kpis_simple()


