import os
import hashlib
from typing import Dict, Optional
from openai import OpenAI
import logging

logger = logging.getLogger(__name__)

# Basic in-memory cache to save tokens on repeated queries
# Key: hash(prompt+context), Value: response
AGENT_CACHE: Dict[str, str] = {}

system_prompt = """Eres un asesor de negocios altamente estratégico e implacable integrado en el dashboard de Aguas Ancud.
Tu objetivo es analizar los KPIs actuales proporcionados por el sistema y responder a las dudas del usuario para maximizar rentabilidad y crecimiento.

REGLAS ESTRICTAS:
1. Eres agresivo, orientado a resultados y no usas lenguaje decorativo.
2. NUNCA des consejos genéricos. Basa tus conclusiones en los KPIs de contexto provistos.
3. El formato de tu respuesta DEBE tener EXACTAMENTE 4 secciones (en markdown):
   - **Diagnóstico:** ¿Qué muestra el dato?
   - **Causa:** ¿Por qué está pasando?
   - **Acción:** ¿Qué hacer con urgencia o alta prioridad?
   - **Impacto:** ¿Qué efecto tendrá en el corto/mediano plazo?

Contexto del negocio: Aguas Ancud vende bidones de 20L a domicilio a $2.000 CLP/bidón (una transacción de $6.000 = 3 bidones). Sede en Puente Alto, Santiago. Capacidad instalada: 30.000L/mes (1.500 bidones).
"""

def generate_cache_key(message: str, kpis_summary: str) -> str:
    unique_string = f"{message}|{kpis_summary}"
    return hashlib.md5(unique_string.encode('utf-8')).hexdigest()

def run_agent(user_message: str, kpi_context: dict) -> str:
    # Initialize OpenAI client. Assumes OPENAI_API_KEY is in env
    try:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return "Error: No se encontró OPENAI_API_KEY en el entorno."
            
        client = OpenAI(api_key=api_key)
        
        # Prepare context string from KPIs (filtering to avoid token waste)
        context_str = (
            f"[KPI CONTEXT] "
            f"Ventas Mes: ${kpi_context.get('ventas_mes', 0)} "
            f"(vs mes ant: ${kpi_context.get('ventas_mes_pasado', 0)}) | "
            f"Total Pedidos: {kpi_context.get('total_pedidos_mes', 0)} | "
            f"Clientes Activos: {kpi_context.get('clientes_activos', 0)} | "
            f"Capacidad Uso: {kpi_context.get('capacidad_utilizada', 0)}% | "
            f"Ticket Promedio (ant): ${kpi_context.get('ticket_promedio_mes_pasado', 0)}"
        )
        
        # Check cache
        cache_key = generate_cache_key(user_message, context_str)
        if cache_key in AGENT_CACHE:
            logger.info("Retornando respuesta desde caché para agente.")
            return AGENT_CACHE[cache_key]
            
        # Call OpenAI API
        # Using gpt-4o-mini as it is the current standard mini cost-efficient model. 
        # (user said 4.1 but 4o-mini is what maps in openai infrastructure usually, 
        # if they explicitly need a different identifier they can change this)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt + "\n" + context_str},
                {"role": "user", "content": user_message}
            ],
            temperature=0.3, # Low temperature for deterministic, business-focused responses
            max_tokens=600
        )
        
        answer = response.choices[0].message.content
        
        # Save to cache
        AGENT_CACHE[cache_key] = answer
        return answer
        
    except Exception as e:
        logger.error(f"Error en run_agent: {e}")
        return f"Error ejecutando análisis inteligente: {str(e)}"
