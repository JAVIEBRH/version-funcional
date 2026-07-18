"""
Servicio de Memoria Persistente — SQLite
El agente recuerda qué analizó, qué recomendó y qué pasó.
"""
import sqlite3
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "agent_memory.db")


def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def inicializar_db():
    """Crea las tablas si no existen."""
    try:
        conn = _get_conn()
        c = conn.cursor()

        # Historial de insights generados
        c.execute("""
            CREATE TABLE IF NOT EXISTS insights_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                tipo TEXT,
                prioridad TEXT,
                mensaje TEXT,
                impacto TEXT,
                accion TEXT,
                contexto_json TEXT
            )
        """)

        # Recomendaciones y su seguimiento
        c.execute("""
            CREATE TABLE IF NOT EXISTS recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                zona TEXT,
                tipo TEXT,
                descripcion TEXT,
                ejecutada INTEGER DEFAULT 0,
                resultado TEXT,
                fecha_ejecucion TEXT
            )
        """)

        # Briefings diarios
        c.execute("""
            CREATE TABLE IF NOT EXISTS daily_briefings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha TEXT NOT NULL UNIQUE,
                contenido TEXT,
                metricas_json TEXT,
                generado_en TEXT
            )
        """)

        # KPIs históricos (snapshot diario para comparación)
        c.execute("""
            CREATE TABLE IF NOT EXISTS kpi_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha TEXT NOT NULL,
                ventas_mes INTEGER,
                pedidos_mes INTEGER,
                clientes_activos INTEGER,
                utilidad INTEGER,
                ticket_promedio INTEGER,
                zona_lider TEXT,
                churn_count INTEGER,
                datos_json TEXT
            )
        """)

        conn.commit()
        conn.close()
        logger.info("Base de datos de memoria inicializada")
    except Exception as e:
        logger.error(f"Error inicializando DB de memoria: {e}")


def guardar_insight(insight: Dict, contexto: Dict = None):
    """Persiste un insight generado por el agente."""
    try:
        conn = _get_conn()
        conn.execute("""
            INSERT INTO insights_history
            (timestamp, tipo, prioridad, mensaje, impacto, accion, contexto_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            datetime.now().isoformat(),
            insight.get("type", ""),
            insight.get("priority", ""),
            insight.get("message", ""),
            insight.get("impact", ""),
            insight.get("action", ""),
            json.dumps(contexto or {}, ensure_ascii=False)
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error guardando insight: {e}")


def guardar_snapshot_kpis(contexto: Dict):
    """Guarda snapshot diario de KPIs para comparación histórica."""
    try:
        conn = _get_conn()
        fecha_hoy = datetime.now().strftime("%Y-%m-%d")
        conn.execute("""
            INSERT OR REPLACE INTO kpi_snapshots
            (fecha, ventas_mes, pedidos_mes, clientes_activos, utilidad, ticket_promedio, zona_lider, churn_count, datos_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            fecha_hoy,
            contexto.get("ventas_mensuales", 0),
            contexto.get("pedidos_mensuales", 0),
            contexto.get("clientes_activos", 0),
            contexto.get("utilidad_neta", 0),
            contexto.get("ticket_promedio", 0),
            contexto.get("zona_lider", ""),
            contexto.get("clientes_en_riesgo_count", 0),
            json.dumps(contexto, ensure_ascii=False)
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error guardando snapshot KPIs: {e}")


def obtener_contexto_historico(dias: int = 30) -> Dict:
    """Recupera contexto de los últimos N días para el agente."""
    try:
        conn = _get_conn()
        desde = (datetime.now() - timedelta(days=dias)).isoformat()

        # Últimos insights
        insights = conn.execute("""
            SELECT tipo, prioridad, mensaje, accion, timestamp
            FROM insights_history
            WHERE timestamp >= ?
            ORDER BY timestamp DESC
            LIMIT 10
        """, (desde,)).fetchall()

        # Snapshots KPIs para ver tendencia
        snapshots = conn.execute("""
            SELECT fecha, ventas_mes, pedidos_mes, clientes_activos, zona_lider, churn_count
            FROM kpi_snapshots
            WHERE fecha >= ?
            ORDER BY fecha DESC
            LIMIT 30
        """, ((datetime.now() - timedelta(days=dias)).strftime("%Y-%m-%d"),)).fetchall()

        # Briefing de hoy si existe
        briefing_hoy = conn.execute("""
            SELECT contenido FROM daily_briefings WHERE fecha = ?
        """, (datetime.now().strftime("%Y-%m-%d"),)).fetchone()

        conn.close()

        return {
            "insights_recientes": [dict(r) for r in insights],
            "snapshots_kpis": [dict(r) for r in snapshots],
            "briefing_hoy": briefing_hoy["contenido"] if briefing_hoy else None,
        }

    except Exception as e:
        logger.error(f"Error obteniendo contexto histórico: {e}")
        return {"insights_recientes": [], "snapshots_kpis": [], "briefing_hoy": None}


def guardar_briefing(contenido: str, metricas: Dict):
    """Persiste el briefing diario."""
    try:
        conn = _get_conn()
        fecha_hoy = datetime.now().strftime("%Y-%m-%d")
        conn.execute("""
            INSERT OR REPLACE INTO daily_briefings (fecha, contenido, metricas_json, generado_en)
            VALUES (?, ?, ?, ?)
        """, (fecha_hoy, contenido, json.dumps(metricas, ensure_ascii=False), datetime.now().isoformat()))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error guardando briefing: {e}")


def obtener_briefing_hoy() -> Optional[str]:
    """Retorna el briefing del día si ya fue generado."""
    try:
        conn = _get_conn()
        row = conn.execute("""
            SELECT contenido FROM daily_briefings WHERE fecha = ?
        """, (datetime.now().strftime("%Y-%m-%d"),)).fetchone()
        conn.close()
        return row["contenido"] if row else None
    except Exception as e:
        logger.error(f"Error leyendo briefing: {e}")
        return None


def obtener_historial_insights(limite: int = 20) -> List[Dict]:
    """Retorna los últimos N insights para mostrar en frontend."""
    try:
        conn = _get_conn()
        rows = conn.execute("""
            SELECT tipo, prioridad, mensaje, impacto, accion, timestamp
            FROM insights_history
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limite,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Error leyendo historial: {e}")
        return []


def guardar_recomendacion(rec: dict) -> int:
    """Persiste una recomendación generada por el agente. Retorna el ID."""
    try:
        conn = _get_conn()
        cursor = conn.execute("""
            INSERT INTO recommendations (timestamp, zona, tipo, descripcion)
            VALUES (?, ?, ?, ?)
        """, (
            datetime.now().isoformat(),
            rec.get("zona", "general"),
            rec.get("tipo", ""),
            rec.get("descripcion", "")[:500],
        ))
        conn.commit()
        rec_id = cursor.lastrowid
        conn.close()
        return rec_id
    except Exception as e:
        logger.error(f"Error guardando recomendación: {e}")
        return -1


def actualizar_recomendacion(rec_id: int, ejecutada: bool, resultado: str = ""):
    """Marca una recomendación como ejecutada y guarda el resultado."""
    try:
        conn = _get_conn()
        conn.execute("""
            UPDATE recommendations
            SET ejecutada = ?, resultado = ?, fecha_ejecucion = ?
            WHERE id = ?
        """, (
            1 if ejecutada else 0,
            resultado,
            datetime.now().isoformat(),
            rec_id,
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error actualizando recomendación {rec_id}: {e}")


def get_recent_recommendations(limit: int = 3) -> List[Dict]:
    """Retorna las últimas N recomendaciones con su estado de ejecución."""
    try:
        conn = _get_conn()
        rows = conn.execute("""
            SELECT id, timestamp, tipo, descripcion, ejecutada, resultado
            FROM recommendations
            ORDER BY timestamp DESC
            LIMIT ?
        """, (limit,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Error obteniendo recomendaciones: {e}")
        return []
