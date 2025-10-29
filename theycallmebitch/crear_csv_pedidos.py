#!/usr/bin/env python3
"""
Script para crear CSV de pedidos desde el endpoint
"""

import requests
import pandas as pd
import json
from datetime import datetime

def obtener_pedidos_y_crear_csv():
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
        
        # Filtrar por mes actual (octubre 2025)
        mes_actual = 10
        anio_actual = 2025
        pedidos_mes_actual = df_ancud[
            (df_ancud['fecha_parsed'].dt.month == mes_actual) & 
            (df_ancud['fecha_parsed'].dt.year == anio_actual)
        ]
        
        print(f"Pedidos del mes actual (octubre 2025): {len(pedidos_mes_actual)} registros")
        
        # Crear CSV con datos del mes actual
        csv_filename = "pedidos_octubre_2025.csv"
        pedidos_mes_actual.to_csv(csv_filename, index=False, encoding='utf-8')
        print(f"CSV creado: {csv_filename}")
        
        # Crear resumen
        resumen = {
            "total_pedidos": len(pedidos_mes_actual),
            "ventas_totales": pedidos_mes_actual['precio_numeric'].sum(),
            "precio_promedio": pedidos_mes_actual['precio_numeric'].mean(),
            "clientes_unicos": pedidos_mes_actual['usuario'].nunique(),
            "bidones_totales": pedidos_mes_actual['ordenpedido'].astype(str).str.replace(r'[^\d]', '', regex=True).astype(int).sum(),
            "fecha_inicio": pedidos_mes_actual['fecha_parsed'].min(),
            "fecha_fin": pedidos_mes_actual['fecha_parsed'].max()
        }
        
        print("\n=== RESUMEN DEL MES ACTUAL ===")
        for key, value in resumen.items():
            print(f"{key}: {value}")
        
        # Guardar resumen
        with open("resumen_octubre_2025.json", "w", encoding="utf-8") as f:
            json.dump(resumen, f, indent=2, ensure_ascii=False, default=str)
        
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    obtener_pedidos_y_crear_csv()


