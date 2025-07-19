import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { getPedidosPorHorario } from '../services/api';

const PedidosPorBloqueDonut = ({ 
  pedidosManana = 0, 
  pedidosTarde = 0,
  title = 'Pedidos por Horario'
}) => {
  const theme = useTheme();
  const [horarioData, setHorarioData] = useState({
    pedidos_manana: pedidosManana,
    pedidos_tarde: pedidosTarde,
    total: pedidosManana + pedidosTarde,
    porcentaje_manana: 0,
    porcentaje_tarde: 0
  });
  const [loading, setLoading] = useState(false);
  
  const fetchPedidosPorHorario = async () => {
    try {
      setLoading(true);
      const data = await getPedidosPorHorario();
      setHorarioData({
        pedidos_manana: data.pedidos_manana || 0,
        pedidos_tarde: data.pedidos_tarde || 0,
        total: data.total || 0,
        porcentaje_manana: data.porcentaje_manana || 0,
        porcentaje_tarde: data.porcentaje_tarde || 0
      });
    } catch (error) {
      console.error('Error obteniendo pedidos por horario:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidosPorHorario();
    
    // Actualizar cada 15 minutos
    const interval = setInterval(fetchPedidosPorHorario, 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  const total = horarioData.pedidos_manana + horarioData.pedidos_tarde;
  const porcentajeManana = total > 0 ? horarioData.porcentaje_manana : 0;
  const porcentajeTarde = total > 0 ? horarioData.porcentaje_tarde : 0;
  
  const radius = 60;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  
  const mananaOffset = circumference - (porcentajeManana / 100) * circumference;
  const tardeOffset = circumference - (porcentajeTarde / 100) * circumference;

  return (
    <div style={{
      background: theme.palette.mode === 'dark' 
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
        : 'linear-gradient(135deg, #f8f9ff 0%, #e8eaff 100%)',
      borderRadius: 16,
      boxShadow: theme.palette.mode === 'dark' 
        ? '0 4px 20px rgba(0, 0, 0, 0.3)'
        : '0 4px 20px rgba(0, 0, 0, 0.08)',
      padding: 28,
      border: `1px solid ${theme.palette.mode === 'dark' 
        ? 'rgba(147, 112, 219, 0.2)' 
        : 'rgba(147, 112, 219, 0.1)'}`,
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden'
    }}
    onClick={fetchPedidosPorHorario}
    >
      <div style={{ 
        fontSize: '1.125rem', 
        fontWeight: 700, 
        color: theme.palette.text.primary, 
        marginBottom: 20, 
        textAlign: 'center',
        fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
        letterSpacing: '0.025em',
        textTransform: 'uppercase',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}>
        {title}
        {loading && <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#9370db' }}>🔄</span>}
      </div>
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        marginBottom: 20
      }}>
        <svg width="140" height="140" style={{ position: 'relative' }}>
          {/* Fondo del donut */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            stroke={theme.palette.mode === 'dark' ? '#374151' : '#e2e8f0'}
            strokeWidth={strokeWidth}
            fill="none"
          />
          
          {/* Segmento de la mañana */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            stroke="#3b82f6"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={mananaOffset}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          
          {/* Segmento de la tarde */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            stroke="#10b981"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={tardeOffset}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          
          {/* Texto central */}
          <text
            x="70"
            y="70"
            textAnchor="middle"
            fontSize="18"
            fill={theme.palette.text.primary}
            fontWeight="700"
            dy=".3em"
            fontFamily='"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
            style={{
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              textRendering: 'optimizeLegibility'
            }}
          >
            {total}
          </text>
          <text
            x="70"
            y="85"
            textAnchor="middle"
            fontSize="12"
            fill={theme.palette.text.secondary}
            fontFamily='"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
            style={{
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              textRendering: 'optimizeLegibility'
            }}
          >
            Total
          </text>
        </svg>
      </div>
      
      {/* Leyenda */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 8
        }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: '#3b82f6'
          }} />
          <div style={{
            fontSize: '0.875rem',
            color: theme.palette.text.primary,
            fontWeight: 500,
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            Mañana ({porcentajeManana}%)
          </div>
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: 8
        }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: '#10b981'
          }} />
          <div style={{
            fontSize: '0.875rem',
            color: theme.palette.text.primary,
            fontWeight: 500,
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            Tarde ({porcentajeTarde}%)
          </div>
        </div>
      </div>
      
      {/* Detalles adicionales */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        marginTop: 16,
        padding: '12px 16px',
        background: theme.palette.mode === 'dark' 
          ? 'rgba(147, 112, 219, 0.1)' 
          : 'rgba(147, 112, 219, 0.05)',
        borderRadius: 8,
        border: `1px solid ${theme.palette.mode === 'dark' 
          ? 'rgba(147, 112, 219, 0.2)' 
          : 'rgba(147, 112, 219, 0.1)'}`
      }}>
        <div style={{
          textAlign: 'center',
          flex: 1
        }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#3b82f6',
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
          }}>
            {horarioData.pedidos_manana}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: theme.palette.text.secondary,
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
          }}>
            11-13h
          </div>
        </div>
        
        <div style={{
          textAlign: 'center',
          flex: 1
        }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#10b981',
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
          }}>
            {horarioData.pedidos_tarde}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: theme.palette.text.secondary,
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
          }}>
            15-19h
          </div>
        </div>
      </div>
    </div>
  );
};

export default PedidosPorBloqueDonut; 