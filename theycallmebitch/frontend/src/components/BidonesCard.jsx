import React from 'react';
import { useTheme } from '@mui/material/styles';

const BidonesCard = ({ 
  title = 'Bidones Vendidos', 
  value = 1250, 
  subtitle = 'Este mes',
  percentageChange = 8.3,
  isPositive = true 
}) => {
  const theme = useTheme();
  
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
    }}>
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
          </div>
          <div style={{ 
            fontSize: '2.5rem', 
            fontWeight: 800, 
            marginBottom: 8,
            color: theme.palette.text.primary,
            fontFamily: '"Roboto", "Helvetica Neue", Arial, sans-serif',
            lineHeight: 1.1
          }}>
            {value.toLocaleString('es-CL')}
          </div>
          <div style={{ 
            fontSize: '0.875rem', 
            color: theme.palette.text.secondary,
            fontWeight: 500
          }}>
            {subtitle}
          </div>
        </div>
        <div style={{
          background: theme.palette.mode === 'dark' 
            ? 'rgba(147, 112, 219, 0.2)' 
            : 'rgba(147, 112, 219, 0.1)',
          borderRadius: 12,
          padding: '8px 12px',
          fontSize: '0.875rem',
          color: isPositive ? '#059669' : '#dc2626',
          fontWeight: 600,
          border: `1px solid ${isPositive ? 'rgba(5, 150, 105, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`
        }}>
          {isPositive ? '+' : ''}{percentageChange.toFixed(1)}%
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
            d="M0 25 Q20 15 40 20 T80 10 T120 15 T160 5 T200 10"
            stroke="#9370db"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M0 25 Q20 15 40 20 T80 10 T120 15 T160 5 T200 10 L200 40 L0 40 Z"
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

export default BidonesCard; 