import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { getPedidos } from '../services/api';

const VentasSemanalesCard = ({ 
  title = 'Ventas Semanales', 
  value = 0, 
  subtitle = 'Esta semana',
  percentageChange = 0,
  isPositive = true 
}) => {
  const theme = useTheme();
  const [ventasData, setVentasData] = useState({
    ventas_semana_actual: value,
    porcentaje_cambio: percentageChange,
    es_positivo: isPositive,
    fecha_inicio_semana: '',
    fecha_fin_semana: ''
  });
  const [loading, setLoading] = useState(false);
  
  const calcularVentasSemanales = async () => {
    try {
      setLoading(true);
      const pedidos = await getPedidos();
      
      // Calcular fechas de semana actual
      const hoy = new Date();
      const inicioSemana = new Date(hoy);
      inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1); // Lunes
      const finSemana = new Date(inicioSemana);
      finSemana.setDate(inicioSemana.getDate() + 6); // Domingo
      
      // Calcular fechas de semana pasada
      const inicioSemanaPasada = new Date(inicioSemana);
      inicioSemanaPasada.setDate(inicioSemana.getDate() - 7);
      const finSemanaPasada = new Date(finSemana);
      finSemanaPasada.setDate(finSemana.getDate() - 7);
      
      // Función para convertir fecha a formato DD-MM-YYYY
      const formatearFecha = (fecha) => {
        return fecha.toLocaleDateString('es-CL', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        });
      };
      
      // Función para verificar si una fecha está en un rango
      const fechaEnRango = (fechaStr, inicio, fin) => {
        const fecha = new Date(fechaStr.split('-').reverse().join('-'));
        return fecha >= inicio && fecha <= fin;
      };
      
      // Filtrar pedidos de semana actual
      const pedidosSemanaActual = pedidos.filter(pedido => {
        return fechaEnRango(pedido.fecha, inicioSemana, finSemana);
      });
      
      const ventasSemanaActual = pedidosSemanaActual.reduce((total, pedido) => {
        return total + (parseInt(pedido.precio) || 0);
      }, 0);
      
      // Filtrar pedidos de semana pasada
      const pedidosSemanaPasada = pedidos.filter(pedido => {
        return fechaEnRango(pedido.fecha, inicioSemanaPasada, finSemanaPasada);
      });
      
      const ventasSemanaPasada = pedidosSemanaPasada.reduce((total, pedido) => {
        return total + (parseInt(pedido.precio) || 0);
      }, 0);
      
      // Calcular porcentaje de cambio
      let porcentajeCambio = 0;
      let esPositivo = true;
      
      if (ventasSemanaPasada > 0) {
        porcentajeCambio = ((ventasSemanaActual - ventasSemanaPasada) / ventasSemanaPasada) * 100;
        esPositivo = ventasSemanaActual >= ventasSemanaPasada;
      } else if (ventasSemanaActual > 0) {
        porcentajeCambio = 100;
        esPositivo = true;
      }
      
      setVentasData({
        ventas_semana_actual: ventasSemanaActual,
        porcentaje_cambio: porcentajeCambio,
        es_positivo: esPositivo,
        fecha_inicio_semana: formatearFecha(inicioSemana),
        fecha_fin_semana: formatearFecha(finSemana)
      });
      
    } catch (error) {
      console.error('Error calculando ventas semanales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calcularVentasSemanales();
    
    // Actualizar cada 10 minutos
    const interval = setInterval(calcularVentasSemanales, 10 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const formatValue = (val) => {
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(1)}M`;
    } else if (val >= 1000) {
      return `$${(val / 1000).toFixed(1)}K`;
    } else {
      return `$${val.toLocaleString('es-CL')}`;
    }
  };

  const getSubtitle = () => {
    if (ventasData.fecha_inicio_semana && ventasData.fecha_fin_semana) {
      return `${ventasData.fecha_inicio_semana} - ${ventasData.fecha_fin_semana}`;
    }
    return subtitle;
  };

  return (
    <div style={{
      background: theme.palette.mode === 'dark' 
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
        : 'linear-gradient(135deg, #f8f9ff 0%, #e8eaff 100%)',
      borderRadius: 16,
      padding: 24,
      color: theme.palette.text.primary,
      boxShadow: theme.palette.mode === 'dark' 
        ? '0 4px 20px rgba(0, 0, 0, 0.3)'
        : '0 4px 20px rgba(0, 0, 0, 0.08)',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      minHeight: 180,
      border: `1px solid ${theme.palette.mode === 'dark' 
        ? 'rgba(147, 112, 219, 0.2)' 
        : 'rgba(147, 112, 219, 0.1)'}`,
      position: 'relative',
      overflow: 'hidden'
    }}
    onClick={calcularVentasSemanales}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '1rem', 
            fontWeight: 700, 
            color: theme.palette.text.primary, 
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {title}
            {loading && <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#9370db' }}>🔄</span>}
          </div>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: 800, 
            marginBottom: 8,
            color: theme.palette.text.primary,
            fontFamily: '"Roboto", "Helvetica Neue", Arial, sans-serif',
            lineHeight: 1.1
          }}>
            {formatValue(ventasData.ventas_semana_actual)}
          </div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: theme.palette.text.secondary,
            fontWeight: 500
          }}>
            {getSubtitle()}
          </div>
        </div>
        <div style={{
          background: theme.palette.mode === 'dark' 
            ? 'rgba(147, 112, 219, 0.2)' 
            : 'rgba(147, 112, 219, 0.1)',
          borderRadius: 12,
          padding: '8px 12px',
          fontSize: '0.875rem',
          color: ventasData.es_positivo ? '#059669' : '#dc2626',
          fontWeight: 600,
          border: `1px solid ${ventasData.es_positivo ? 'rgba(5, 150, 105, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`
        }}>
          {ventasData.es_positivo ? '+' : ''}{ventasData.porcentaje_cambio.toFixed(1)}%
        </div>
      </div>
      
      {/* Gráfico de tendencia semanal */}
      <div style={{ 
        width: '100%', 
        height: 40, 
        marginTop: 16,
        position: 'relative'
      }}>
        <svg width="100%" height="40" style={{ overflow: 'visible' }}>
          <path
            d="M0 30 Q25 20 50 25 T100 15 T150 20 T200 10"
            stroke="#9370db"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M0 30 Q25 20 50 25 T100 15 T150 20 T200 10 L200 40 L0 40 Z"
            fill="url(#gradient)"
            opacity="0.3"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#9370db" stopOpacity="0.6"/>
              <stop offset="100%" stopColor="#9370db" stopOpacity="0.1"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

export default VentasSemanalesCard; 