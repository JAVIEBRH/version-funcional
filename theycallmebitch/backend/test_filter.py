import requests
import json

def test_filters():
    """Prueba los filtros de Aguas Ancud"""
    base_url = "http://localhost:8000"
    
    print("=== PRUEBA DE FILTROS AGUAS ANCUD ===\n")
    
    # Probar endpoint de pedidos
    try:
        response = requests.get(f"{base_url}/pedidos")
        pedidos = response.json()
        print(f"✅ Pedidos filtrados: {len(pedidos)} pedidos")
        
        if pedidos:
            # Verificar que todos son de Aguas Ancud
            locales = set(p['nombrelocal'] for p in pedidos if 'nombrelocal' in p)
            print(f"   Locales encontrados: {locales}")
            
            if len(locales) == 1 and 'Aguas Ancud' in locales:
                print("   ✅ Todos los pedidos son de Aguas Ancud")
            else:
                print("   ❌ ERROR: Hay pedidos de otros locales")
        
    except Exception as e:
        print(f"❌ Error en pedidos: {e}")
    
    # Probar endpoint de KPIs
    try:
        response = requests.get(f"{base_url}/kpis")
        kpis = response.json()
        print(f"\n✅ KPIs calculados:")
        print(f"   - Ventas del mes: ${kpis.get('ventas_mes', 0):,}")
        print(f"   - Clientes activos: {kpis.get('clientes_activos', 0)}")
        print(f"   - Total pedidos mes: {kpis.get('total_pedidos_mes', 0)}")
        
    except Exception as e:
        print(f"❌ Error en KPIs: {e}")
    
    # Probar endpoint de clientes
    try:
        response = requests.get(f"{base_url}/clientes")
        clientes = response.json()
        print(f"\n✅ Clientes filtrados: {len(clientes)} clientes")
        
        if clientes:
            # Verificar que todos son de Aguas Ancud
            locales = set(c.get('nombrelocal', c.get('local', '')) for c in clientes)
            print(f"   Locales encontrados: {locales}")
            
            if len(locales) == 1 and 'Aguas Ancud' in locales:
                print("   ✅ Todos los clientes son de Aguas Ancud")
            else:
                print("   ❌ ERROR: Hay clientes de otros locales")
        
    except Exception as e:
        print(f"❌ Error en clientes: {e}")

if __name__ == "__main__":
    test_filters() 