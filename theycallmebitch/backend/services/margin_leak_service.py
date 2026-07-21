"""
Servicio de detección de fuga de margen.

Cruza el revenue por pedido de cada zona (ya calculado por zone_engine)
con el costo REAL de combustible del día (fuel_service), en vez de un
costo fijo asumido — para detectar zonas donde el costo de despacho se
está comiendo el margen sin que ningún KPI actual lo muestre.
"""
import logging
from typing import Dict

logger = logging.getLogger(__name__)

UMBRAL_FUGA_PCT = 0.15  # costo de combustible > 15% del ticket promedio de la zona = fuga


def detectar_fuga_margen(zonas_data: Dict, precio_combustible_litro: float, consumo_km_por_litro: float = 10.0) -> Dict:
    zonas = zonas_data.get("zonas", [])
    fugas = []

    for z in zonas:
        distancia = z.get("distancia_km")
        pedidos_30d = z.get("pedidos_30d", 0)
        revenue_30d = z.get("revenue_30d", 0)

        if not distancia or pedidos_30d <= 0 or precio_combustible_litro <= 0:
            continue

        ticket_promedio = revenue_30d / pedidos_30d
        # ida y vuelta
        costo_combustible_viaje = (distancia * 2 / consumo_km_por_litro) * precio_combustible_litro

        if ticket_promedio > 0 and (costo_combustible_viaje / ticket_promedio) > UMBRAL_FUGA_PCT:
            fugas.append({
                "zona": z["zona"],
                "ticket_promedio": round(ticket_promedio, 0),
                "costo_combustible_por_pedido": round(costo_combustible_viaje, 0),
                "pct_del_ticket": round((costo_combustible_viaje / ticket_promedio) * 100, 1),
            })

    return {"fugas": fugas}
