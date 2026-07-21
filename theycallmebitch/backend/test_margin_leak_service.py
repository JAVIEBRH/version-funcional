from services.margin_leak_service import detectar_fuga_margen


def test_detecta_zona_con_costo_combustible_desproporcionado():
    zonas_data = {
        "zonas": [
            {"zona": "macul", "distancia_km": 13, "revenue_30d": 60000, "pedidos_30d": 3},  # ticket ~20000, pocos pedidos, muy lejos
            # NOTA: brief original usaba distancia_km=12, pero con la formula verbatim
            # (ida y vuelta, consumo=10, precio=1200) eso da 2880/20000=14.4%, que NO
            # supera el umbral de 15% descrito. Se ajusto a 13km (15.6%) para que el
            # fixture realmente ejercite el comportamiento que el test describe, sin
            # tocar la formula de negocio de detectar_fuga_margen.
            {"zona": "puente_alto", "distancia_km": 2, "revenue_30d": 200000, "pedidos_30d": 40},
        ]
    }
    resultado = detectar_fuga_margen(zonas_data, precio_combustible_litro=1200, consumo_km_por_litro=10)
    zonas_fuga = [z['zona'] for z in resultado['fugas']]
    assert 'macul' in zonas_fuga


def test_sin_zonas_no_rompe():
    assert detectar_fuga_margen({"zonas": []}, precio_combustible_litro=1200, consumo_km_por_litro=10) == {"fugas": []}
