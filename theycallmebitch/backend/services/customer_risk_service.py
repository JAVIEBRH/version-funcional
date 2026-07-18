"""
Servicio de riesgo de clientes.

Dos mejoras sobre un umbral fijo de "días sin comprar":
1. Cadencia personal: el intervalo típico de compra de CADA cliente
   (mediana de días entre sus propios pedidos), no un número igual para
   todos los clientes de un segmento.
2. Probabilidad empírica de reorden (capa "Markov"): frecuencia REAL,
   observada en el historial completo, de que un cliente que se atrasó
   tanto respecto a su propia cadencia haya vuelto a comprar dentro de la
   ventana de reorden — no una fórmula inventada.

La lista final se prioriza por cuánto se pierde si el cliente se va:
(1 - probabilidad_reorden) * gasto_promedio.
"""
import logging
from datetime import datetime
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

VENTANA_REORDEN_DIAS = 15
UMBRAL_INACTIVO_RATIO = 2.5  # veces la cadencia personal -> inactivo
PROBABILIDAD_RESPALDO_AL_DIA = 0.7
PROBABILIDAD_RESPALDO_ATRASADO = 0.3

# 'estado' por cliente usa singular ('activo', 'inactivo'); el resumen agregado
# usa plural ('activos', 'inactivos'). 'en_riesgo' es igual en ambos.
_RESUMEN_KEY_POR_ESTADO = {
    'activo': 'activos',
    'en_riesgo': 'en_riesgo',
    'inactivo': 'inactivos',
}


def _parsear_fecha(fecha_str: Optional[str]):
    if not fecha_str:
        return None
    for fmt in ("%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(fecha_str)[:10], fmt)
        except (ValueError, TypeError):
            continue
    return None


def _preparar_dataframe(pedidos: List[Dict]) -> pd.DataFrame:
    df = pd.DataFrame(pedidos)
    if df.empty:
        return df
    if 'nombrelocal' in df.columns:
        df = df[df['nombrelocal'].astype(str).str.strip().str.lower() == 'aguas ancud']
    if 'usuario' not in df.columns:
        return pd.DataFrame()
    df = df[df['usuario'].astype(str).str.strip() != '']
    df['fecha_dt'] = df['fecha'].apply(_parsear_fecha)
    df = df.dropna(subset=['fecha_dt'])
    df['precio_num'] = pd.to_numeric(df.get('precio', 0), errors='coerce').fillna(0)
    return df


def _cadencia_por_cliente(df: pd.DataFrame) -> Dict[str, float]:
    """Mediana de días entre pedidos consecutivos, por cliente. Clientes
    con menos de 2 pedidos no tienen cadencia propia (no aparecen en el dict)."""
    cadencias = {}
    for usuario, grupo in df.groupby('usuario'):
        fechas = sorted(grupo['fecha_dt'].tolist())
        if len(fechas) < 2:
            continue
        intervalos = [(fechas[i] - fechas[i - 1]).days for i in range(1, len(fechas))]
        cadencias[usuario] = float(np.median(intervalos))
    return cadencias


def _bucket_de_atraso(dias_atraso: int, cadencia: float) -> str:
    if dias_atraso <= 0:
        return 'al_dia'
    ratio = dias_atraso / cadencia
    if ratio <= 0.5:
        return 'leve'
    if ratio <= 1.5:
        return 'moderado'
    return 'severo'


def _probabilidades_empiricas(df: pd.DataFrame, cadencias: Dict[str, float]) -> Dict[str, Optional[float]]:
    """Para cada uno de los pedidos PASADOS de cada cliente (excluyendo el
    último, que no tiene un "siguiente pedido" observable), calcula qué tan
    atrasado estaba respecto a su cadencia personal en ese momento, y si
    efectivamente volvió a comprar dentro de la ventana de reorden. Agrupa
    por bucket de atraso y devuelve la frecuencia real observada."""
    buckets = {'al_dia': [], 'leve': [], 'moderado': [], 'severo': []}

    for usuario, grupo in df.groupby('usuario'):
        cadencia = cadencias.get(usuario)
        if not cadencia or cadencia <= 0:
            continue
        fechas = sorted(grupo['fecha_dt'].tolist())
        for i in range(len(fechas) - 1):
            gap = (fechas[i + 1] - fechas[i]).days
            atraso_en_ese_momento = max(0, gap - round(cadencia))
            bucket = _bucket_de_atraso(atraso_en_ese_momento, cadencia)
            reordeno_a_tiempo = gap <= cadencia + VENTANA_REORDEN_DIAS
            buckets[bucket].append(reordeno_a_tiempo)

    return {
        bucket: (round(sum(obs) / len(obs), 2) if obs else None)
        for bucket, obs in buckets.items()
    }


def calcular_riesgo_clientes(pedidos: List[Dict]) -> Dict:
    """Punto de entrada principal."""
    vacio = {'resumen': {'activos': 0, 'en_riesgo': 0, 'inactivos': 0}, 'clientes': []}

    df = _preparar_dataframe(pedidos)
    if df.empty:
        return vacio

    cadencias = _cadencia_por_cliente(df)
    probabilidades_por_bucket = _probabilidades_empiricas(df, cadencias)

    hoy = datetime.now()
    resumen = {'activos': 0, 'en_riesgo': 0, 'inactivos': 0}
    clientes_resultado = []

    for usuario, grupo in df.groupby('usuario'):
        ultima_compra = max(grupo['fecha_dt'])
        recencia_dias = (hoy - ultima_compra).days
        gasto_promedio = float(grupo['precio_num'].mean())
        telefono = str(grupo.sort_values('fecha_dt', ascending=False)['telefonou'].iloc[0]) if 'telefonou' in grupo.columns else ''
        direccion = str(grupo.sort_values('fecha_dt', ascending=False)['dire'].iloc[0]) if 'dire' in grupo.columns else ''

        cadencia = cadencias.get(usuario)

        if cadencia and cadencia > 0:
            dias_atraso = max(0, recencia_dias - round(cadencia))
            bucket = _bucket_de_atraso(dias_atraso, cadencia)
            probabilidad = probabilidades_por_bucket.get(bucket)
            umbral_inactivo = cadencia * UMBRAL_INACTIVO_RATIO
        else:
            # Un solo pedido histórico: no hay cadencia propia que calcular.
            dias_atraso = 0
            probabilidad = None
            umbral_inactivo = 45  # respaldo genérico solo para este caso

        if probabilidad is None:
            probabilidad = PROBABILIDAD_RESPALDO_AL_DIA if dias_atraso <= 0 else PROBABILIDAD_RESPALDO_ATRASADO

        if dias_atraso <= 0:
            estado = 'activo'
        elif recencia_dias <= umbral_inactivo:
            estado = 'en_riesgo'
        else:
            estado = 'inactivo'

        resumen[_RESUMEN_KEY_POR_ESTADO[estado]] += 1
        valor_en_juego = round((1 - probabilidad) * gasto_promedio, 0)

        clientes_resultado.append({
            'usuario': usuario,
            'telefono': telefono,
            'direccion': direccion,
            'ultima_compra': ultima_compra.strftime('%d-%m-%Y'),
            'dias_atraso': int(dias_atraso),
            'cadencia_personal_dias': round(cadencia, 1) if cadencia else None,
            'gasto_promedio': round(gasto_promedio, 0),
            'probabilidad_reorden': probabilidad,
            'estado': estado,
            'valor_en_juego': valor_en_juego,
        })

    clientes_resultado.sort(key=lambda c: c['valor_en_juego'], reverse=True)

    return {'resumen': resumen, 'clientes': clientes_resultado}
