#!/usr/bin/env python3
"""
Script para crear datos del mes anterior (septiembre 2025)
"""

import requests
import pandas as pd
import json
from datetime import datetime

def obtener_datos_mes_anterior():
    try:
        print("Obteniendo datos de pedidos...")
        response = requests.get("http://localhost:8001/pedidos", timeout=30)
        response.raise_for_status()
        pedidos = response.json()
        
        print(f"Pedidos obtenidos: {len(pedidos)} registros")
        
        # Convertir a DataFrame
        df = pd.DataFrame(pedidos)
        
        # Filtrar solo Aguas Ancud
        df_ancud = df[df['nombrelocal'] == 'Aguas Ancud'].copy()
        print(f"Pedidos de Aguas Ancud: {len(df_ancud)} registros")
        
        # Convertir fechas
        df_ancud['fecha_parsed'] = pd.to_datetime(df_ancud['fecha'], format='%d-%m-%Y', errors='coerce')
        df_ancud['precio_numeric'] = pd.to_numeric(df_ancud['precio'], errors='coerce')
        
        # Filtrar por mes anterior (septiembre 2025)
        mes_anterior = 9
        anio_anterior = 2025
        pedidos_mes_anterior = df_ancud[
            (df_ancud['fecha_parsed'].dt.month == mes_anterior) & 
            (df_ancud['fecha_parsed'].dt.year == anio_anterior)
        ]
        
        print(f"Pedidos del mes anterior (septiembre 2025): {len(pedidos_mes_anterior)} registros")
        
        # Crear resumen del mes anterior
        resumen_anterior = {
            "total_pedidos": len(pedidos_mes_anterior),
            "ventas_totales": pedidos_mes_anterior['precio_numeric'].sum(),
            "precio_promedio": pedidos_mes_anterior['precio_numeric'].mean(),
            "clientes_unicos": pedidos_mes_anterior['usuario'].nunique(),
            "bidones_totales": pedidos_mes_anterior['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum(),
            "fecha_inicio": pedidos_mes_anterior['fecha_parsed'].min(),
            "fecha_fin": pedidos_mes_anterior['fecha_parsed'].max()
        }
        
        print("\n=== RESUMEN DEL MES ANTERIOR (SEPTIEMBRE) ===")
        for key, value in resumen_anterior.items():
            print(f"{key}: {value}")
        
        # Guardar resumen del mes anterior
        with open("resumen_septiembre_2025.json", "w", encoding="utf-8") as f:
            json.dump(resumen_anterior, f, indent=2, ensure_ascii=False, default=str)
        
        # Crear CSV del mes anterior
        csv_filename = "pedidos_septiembre_2025.csv"
        pedidos_mes_anterior.to_csv(csv_filename, index=False, encoding='utf-8')
        print(f"CSV creado: {csv_filename}")
        
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    obtener_datos_mes_anterior()


