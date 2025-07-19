import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { getPedidos } from '../services/api';

const VentasDiariasCard = ({ 
  title = 'Ventas Diarias', 
  value = 0, 
  subtitle = 'Hoy',
  percentageChange = 0,
  isPositive = true 
}) => {
  const theme = useTheme();
  const [ventasData, setVentasData] = useState({
    ventas_hoy: value,
    porcentaje_cambio: percentageChange,
    es_positivo: isPositive,
    fecha: subtitle
  });
  const [loading, setLoading] = useState(false);
  
  const calcularVentasDiarias = async () => {
    try {
      setLoading(true);
      const pedidos = await getPedidos();
      
      // Filtrar pedidos de hoy
      const hoy = new Date();
      const fechaHoy = hoy.toLocaleDateString('es-CL', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      
      const pedidosHoy = pedidos.filter(pedido => {
        return pedido.fecha === fechaHoy;
      });
      
      const ventasHoy = pedidosHoy.reduce((total, pedido) => {
        return total + (parseInt(pedido.precio) || 0);
      }, 0);
      
      // Filtrar pedidos de ayer
      const ayer = new Date(hoy);
      ayer.setDate(hoy.getDate() - 1);
      const fechaAyer = ayer.toLocaleDateString('es-CL', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      
      const pedidosAyer = pedidos.filter(pedido => {
        return pedido.fecha === fechaAyer;
      });
      
      const ventasAyer = pedidosAyer.reduce((total, pedido) => {
        return total + (parseInt(pedido.precio) || 0);
      }, 0);
      
      // Calcular porcentaje de cambio
      let porcentajeCambio = 0;
      let esPositivo = true;
      
      if (ventasAyer > 0) {
        porcentajeCambio = ((ventasHoy - ventasAyer) / ventasAyer) * 100;
        esPositivo = ventasHoy >= ventasAyer;
      } else if (ventasHoy > 0) {
        porcentajeCambio = 100;
        esPositivo = true;
      }
      
      setVentasData({
        ventas_hoy: ventasHoy,
        porcentaje_cambio: porcentajeCambio,
        es_positivo: esPositivo,
        fecha: fechaHoy
      });
      
    } catch (error) {
      console.error('Error calculando ventas diarias:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calcularVentasDiarias();
    
    // Actualizar cada 5 minutos
    const interval = setInterval(calcularVentasDiarias, 5 * 60 * 1000);
    
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
    onClick={calcularVentasDiarias}
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
            {formatValue(ventasData.ventas_hoy)}
          </div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: theme.palette.text.secondary,
            fontWeight: 500
          }}>
            {ventasData.fecha}
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
      
      {/* Gráfico de tendencia simplificado */}
      <div style={{ 
        width: '100%', 
        height: 40, 
        marginTop: 16,
        position: 'relative'
      }}>
        <svg width="100%" height="40" style={{ overflow: 'visible' }}>
          <path
            d="M0 35 Q20 25 40 30 T80 20 T120 25 T160 15 T200 20"
            stroke="#9370db"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M0 35 Q20 25 40 30 T80 20 T120 25 T160 15 T200 20 L200 40 L0 40 Z"
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

export default VentasDiariasCard; 