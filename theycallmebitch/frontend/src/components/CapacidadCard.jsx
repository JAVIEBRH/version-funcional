import React from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import { glassCardSx, GLASS_FONT_HEADING, GLASS_FONT_BODY } from '../utils/glassCard';

const CircularProgressBar = ({ value, size = 140, stroke = 12, color = '#3b82f6', bgColor = '#e2e8f0', theme }) => {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={theme.palette.mode === 'dark' ? '#374151' : bgColor}
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        fontSize={size * 0.28}
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
        {`${value}%`}
      </text>
    </svg>
  );
};

const CapacidadCard = ({ 
  title = 'Capacidad de Producción', 
  value = 85, 
  subtitle = 'Litros vendidos este mes',
  maxValue = 100,
  unit = '%',
  litrosVendidos = 0,
  capacidadTotal = 30000
}) => {
  const theme = useTheme();
  const percentage = value; // El valor ya viene como porcentaje
  
  // Determinar el color según el porcentaje
  const getProgressColor = (percent) => {
    if (percent < 60) return '#10b981'; // Verde
    if (percent < 80) return '#f59e0b'; // Amarillo
    if (percent < 95) return '#f97316'; // Naranja
    return '#dc2626'; // Rojo
  };

  const progressColor = getProgressColor(percentage);

  return (
    <Box sx={{
      ...glassCardSx(theme, progressColor),
      padding: 4,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      height: '100%',
    }}>
      <div style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        color: theme.palette.text.secondary,
        marginBottom: 16,
        textAlign: 'center',
        fontFamily: GLASS_FONT_HEADING,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}>
        {title}
      </div>

      <CircularProgressBar value={percentage} color={progressColor} theme={theme} />

              <div style={{
          fontSize: '1.125rem',
          color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.8)' : theme.palette.text.secondary,
          margin: '20px 0 12px 0',
          textAlign: 'center',
          fontWeight: 500,
          fontFamily: GLASS_FONT_BODY,
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility'
        }}>
          Litros vendidos este mes
        </div>

      <div style={{ width: '100%', margin: '12px 0' }}>
        <div style={{
          width: '100%',
          height: 8,
          background: theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            background: progressColor,
            borderRadius: 4,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      <div style={{
        fontSize: '0.95rem',
        color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : theme.palette.text.secondary,
        marginTop: 12,
        textAlign: 'center',
        lineHeight: 1.5,
        fontFamily: GLASS_FONT_BODY,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}>
        {`${litrosVendidos.toLocaleString('es-CL')}L vendidos de ${capacidadTotal.toLocaleString('es-CL')}L disponibles`}
      </div>
    </Box>
  );
};

export default CapacidadCard; 