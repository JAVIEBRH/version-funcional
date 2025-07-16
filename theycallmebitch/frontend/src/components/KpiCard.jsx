import React from 'react';
import { useTheme } from '@mui/material/styles';

const KpiCard = ({ 
  title = 'Clientes Activos', 
  value = 450, 
  subtitle = 'Este mes',
  icon = '👥',
  trend = '+3.1%',
  isPositive = true 
}) => {
  const theme = useTheme();
  
  return (
    <div style={{
      background: theme.palette.mode === 'dark' 
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
        : 'linear-gradient(135deg, #f8f9ff 0%, #e8eaff 100%)',
      borderRadius: 12,
      padding: 20,
      color: theme.palette.text.primary,
      boxShadow: theme.palette.mode === 'dark' 
        ? '0 2px 12px rgba(0, 0, 0, 0.2)'
        : '0 2px 12px rgba(0, 0, 0, 0.06)',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      border: `1px solid ${theme.palette.mode === 'dark' 
        ? 'rgba(147, 112, 219, 0.2)' 
        : 'rgba(147, 112, 219, 0.1)'}`,
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: 700, 
            color: theme.palette.text.primary, 
            marginBottom: 8,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            {title}
          </div>
          <div style={{ 
            fontSize: '1.75rem', 
            fontWeight: 800, 
            marginBottom: 4,
            color: theme.palette.text.primary,
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
            lineHeight: 1.1,
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            {value.toLocaleString('es-CL')}
          </div>
          <div style={{ 
            fontSize: '0.75rem', 
            color: theme.palette.text.secondary,
            fontWeight: 500,
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            {subtitle}
          </div>
        </div>
        <div style={{
          background: theme.palette.mode === 'dark' 
            ? 'rgba(147, 112, 219, 0.2)' 
            : 'rgba(147, 112, 219, 0.1)',
          borderRadius: 8,
          padding: '6px 8px',
          fontSize: '0.75rem',
          color: isPositive ? '#059669' : '#dc2626',
          fontWeight: 600,
          border: `1px solid ${isPositive ? 'rgba(5, 150, 105, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
          fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility'
        }}>
          {trend}
        </div>
      </div>
      
      {/* Gráfico de tendencia simplificado */}
      <div style={{ 
        width: '100%', 
        height: 24, 
        marginTop: 8,
        position: 'relative'
      }}>
        <svg width="100%" height="24" style={{ overflow: 'visible' }}>
          <path
            d="M0 20 Q15 12 30 16 T60 8 T90 12 T120 4 T150 8"
            stroke="#9370db"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M0 20 Q15 12 30 16 T60 8 T90 12 T120 4 T150 8 L150 24 L0 24 Z"
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

export default KpiCard; 