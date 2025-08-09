import React from 'react';
import { useTheme } from '@mui/material/styles';
import { Typography, Box } from '@mui/material';

const CircularProgressBar = ({ value, size = 120, stroke = 10, color = '#3b82f6', bgColor = '#e2e8f0', theme }) => {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  // Permitir valores superiores al 100%
  const progressValue = Math.min(value, 200); // Máximo 200% para evitar overflow visual
  const offset = circ - (progressValue / 100) * circ;
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
        {`${Math.min(value, 200)}%`}
      </text>
    </svg>
  );
};

const KpiMetaCard = ({
  value = 75,
  title = 'Meta de Ventas',
  subtitle = 'Objetivo Mensual',
  description = 'Progreso respecto a la meta establecida para este mes.'
}) => {
  const theme = useTheme();
  
  // Determinar el color según el progreso
  const getProgressColor = (progress) => {
    if (progress < 60) return '#7c2d12'; // Marrón oscuro
    if (progress < 80) return '#92400e'; // Marrón medio
    if (progress < 95) return '#1e40af'; // Azul
    if (progress < 100) return '#10b981'; // Verde
    if (progress < 120) return '#059669'; // Verde oscuro
    return '#047857'; // Verde muy oscuro para >120%
  };

  const progressColor = getProgressColor(value);
  
  return (
    <Box sx={{
      background: theme.palette.mode === 'dark' 
        ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
        : 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.6) 100%)',
      borderRadius: 4,
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      padding: 3,
      minWidth: 'auto',
      maxWidth: 'none',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      border: `1px solid ${theme.palette.mode === 'dark' 
        ? 'rgba(255,255,255,0.08)' 
        : 'rgba(0,0,0,0.08)'}`,
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
      overflow: 'hidden',
      backdropFilter: 'blur(10px)',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: value < 60 ? 
          'linear-gradient(45deg, transparent, rgba(239, 68, 68, 0.6), transparent, rgba(239, 68, 68, 0.6), transparent)' :
          value < 80 ? 
          'linear-gradient(45deg, transparent, rgba(245, 158, 11, 0.6), transparent, rgba(245, 158, 11, 0.6), transparent)' :
          'linear-gradient(45deg, transparent, rgba(34, 197, 94, 0.6), transparent, rgba(34, 197, 94, 0.6), transparent)',
        animation: value < 60 ? 'glowWaveRed 5s ease-in-out infinite' :
                   value < 80 ? 'glowWaveYellow 5s ease-in-out infinite' :
                   'glowWaveGreen 5s ease-in-out infinite',
        zIndex: 0
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 4,
        boxShadow: value < 60 ? 
          '0 0 30px rgba(239, 68, 68, 0.8), 0 0 60px rgba(239, 68, 68, 0.6)' :
          value < 80 ? 
          '0 0 30px rgba(245, 158, 11, 0.8), 0 0 60px rgba(245, 158, 11, 0.6)' :
          '0 0 30px rgba(34, 197, 94, 0.8), 0 0 60px rgba(34, 197, 94, 0.6)',
        animation: value < 60 ? 'glowPulseRed 4s ease-in-out infinite' :
                   value < 80 ? 'glowPulseYellow 4s ease-in-out infinite' :
                   'glowPulseGreen 4s ease-in-out infinite',
        zIndex: 1
      },
      '@keyframes glowWaveRed': {
        '0%': { transform: 'translateX(-100%) translateY(-100%) rotate(0deg)' },
        '50%': { transform: 'translateX(100%) translateY(100%) rotate(180deg)' },
        '100%': { transform: 'translateX(-100%) translateY(-100%) rotate(360deg)' }
      },
      '@keyframes glowWaveYellow': {
        '0%': { transform: 'translateX(-100%) translateY(-100%) rotate(0deg)' },
        '50%': { transform: 'translateX(100%) translateY(100%) rotate(180deg)' },
        '100%': { transform: 'translateX(-100%) translateY(-100%) rotate(360deg)' }
      },
      '@keyframes glowWaveGreen': {
        '0%': { transform: 'translateX(-100%) translateY(-100%) rotate(0deg)' },
        '50%': { transform: 'translateX(100%) translateY(100%) rotate(180deg)' },
        '100%': { transform: 'translateX(-100%) translateY(-100%) rotate(360deg)' }
      },
      '@keyframes glowPulseRed': {
        '0%, 100%': { opacity: 0.7 },
        '50%': { opacity: 1 }
      },
      '@keyframes glowPulseYellow': {
        '0%, 100%': { opacity: 0.7 },
        '50%': { opacity: 1 }
      },
      '@keyframes glowPulseGreen': {
        '0%, 100%': { opacity: 0.7 },
        '50%': { opacity: 1 }
      }
    }}>
      <div style={{ 
        fontSize: '1.125rem', 
        fontWeight: 700, 
        color: theme.palette.text.primary, 
        marginBottom: 16, 
        textAlign: 'center',
        fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
        letterSpacing: '0.025em',
        textTransform: 'uppercase',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        position: 'relative',
        zIndex: 2
      }}>
        {title}
      </div>
      
      <div style={{ position: 'relative', zIndex: 2 }}>
        <CircularProgressBar value={value} color={progressColor} theme={theme} />
      </div>
      
      <Typography 
        variant="body2" 
        sx={{ 
          color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.8)' : theme.palette.text.secondary,
          fontWeight: 500,
          fontSize: '0.95rem', // Aumentado de 0.875rem
          mb: 1,
          position: 'relative',
          zIndex: 2
        }}
      >
        {subtitle}
      </Typography>
      
      <div style={{ width: '100%', margin: '12px 0', position: 'relative', zIndex: 2 }}>
        <div style={{
          width: '100%',
          height: 8,
          background: theme.palette.mode === 'dark' 
            ? 'rgba(147, 112, 219, 0.2)' 
            : 'rgba(147, 112, 219, 0.1)',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(value, 200)}%`,
            height: '100%',
            background: progressColor,
            borderRadius: 4,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>
      
      <Typography 
        variant="body2" 
        sx={{ 
          color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : theme.palette.text.secondary,
          fontSize: '0.85rem', // Aumentado de 0.75rem
          textAlign: 'center',
          lineHeight: 1.4,
          position: 'relative',
          zIndex: 2
        }}
      >
        {description}
      </Typography>
    </Box>
  );
};

export default KpiMetaCard; 