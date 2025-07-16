import React from 'react';
import { useTheme } from '@mui/material/styles';

const PedidosPorBloqueDonut = ({ 
  pedidosManana = 45, 
  pedidosTarde = 33,
  title = 'Pedidos por Horario'
}) => {
  const theme = useTheme();
  
  const total = pedidosManana + pedidosTarde;
  const porcentajeManana = total > 0 ? Math.round((pedidosManana / total) * 100) : 0;
  const porcentajeTarde = total > 0 ? Math.round((pedidosTarde / total) * 100) : 0;
  
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
    }}>
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
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#3b82f6',
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            {pedidosManana}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: theme.palette.text.secondary,
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            Mañana
          </div>
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#10b981',
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            {pedidosTarde}
          </div>
          <div style={{
            fontSize: '0.75rem',
            color: theme.palette.text.secondary,
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            Tarde
          </div>
        </div>
      </div>
    </div>
  );
};

export default PedidosPorBloqueDonut; 