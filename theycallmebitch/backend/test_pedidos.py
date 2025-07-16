import requests
import pandas as pd
from datetime import datetime

ENDPOINT_PEDIDOS = "https://fluvi.cl/fluviDos/GoApp/endpoints/pedidos.php"
HEADERS = {"User-Agent": "Mozilla/5.0"}

def test_pedidos():
    try:
        print("Obteniendo pedidos...")
        response = requests.get(ENDPOINT_PEDIDOS, headers=HEADERS, timeout=10)
        response.raise_for_status()
        pedidos = response.json()
        
        print(f"Total de pedidos: {len(pedidos)}")
        
        df = pd.DataFrame(pedidos)
        print(f"Columnas disponibles: {list(df.columns)}")
        
        if 'nombrelocal' in df.columns:
            print(f"Locales únicos: {df['nombrelocal'].unique()}")
            
            # Filtrar por Aguas Ancud
            df_ancud = df[df['nombrelocal'] == 'Aguas Ancud']
            print(f"Pedidos de Aguas Ancud: {len(df_ancud)}")
            
            if len(df_ancud) > 0:
                print("\nEjemplo de pedido de Aguas Ancud:")
                print(df_ancud.iloc[0].to_dict())
                
                # Verificar campos de hora
                if 'hora' in df_ancud.columns:
                    print(f"\nPedidos con campo 'hora': {df_ancud['hora'].notna().sum()}")
                    print("Ejemplos de horas:")
                    for hora in df_ancud['hora'].dropna().head(5):
                        print(f"  - {hora}")
                
                # Calcular bloques
                bloque_manana = 0
                bloque_tarde = 0
                
                for _, pedido in df_ancud.iterrows():
                    if pd.notna(pedido.get('hora')):
                        hora_str = str(pedido['hora'])
                        print(f"Procesando hora: {hora_str}")
                        
                        # Formato: "02:53 pm" o "11:30 am"
                        import re
                        hora_match = re.match(r'(\d{1,2}):(\d{2})\s*(am|pm)', hora_str.lower())
                        
                        if hora_match:
                            hora = int(hora_match.group(1))
                            ampm = hora_match.group(3)
                            
                            # Convertir a formato 24 horas
                            if ampm == 'pm' and hora != 12:
                                hora += 12
                            elif ampm == 'am' and hora == 12:
                                hora = 0
                            
                            print(f"  Hora convertida: {hora}")
                            
                            if hora >= 11 and hora < 13:
                                bloque_manana += 1
                                print(f"    -> Bloque mañana")
                            elif hora >= 15 and hora < 19:
                                bloque_tarde += 1
                                print(f"    -> Bloque tarde")
                            else:
                                print(f"    -> Fuera de bloques")
                        else:
                            print(f"  No se pudo parsear: {hora_str}")
                
                total = bloque_manana + bloque_tarde
                print(f"\nBloques calculados:")
                print(f"  Mañana (11-13h): {bloque_manana}")
                print(f"  Tarde (15-19h): {bloque_tarde}")
                print(f"  Total: {total}")
                
                if total > 0:
                    porcentaje_manana = round((bloque_manana / total) * 100)
                    porcentaje_tarde = round((bloque_tarde / total) * 100)
                    print(f"  Porcentaje mañana: {porcentaje_manana}%")
                    print(f"  Porcentaje tarde: {porcentaje_tarde}%")
            else:
                print("No se encontraron pedidos de Aguas Ancud")
        else:
            print("No se encontró columna 'nombrelocal'")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_pedidos() 