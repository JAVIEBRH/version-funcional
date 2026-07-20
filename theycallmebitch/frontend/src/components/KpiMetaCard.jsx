import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Typography, Box } from '@mui/material';

const CircularProgressBar = ({ value, size = 120, stroke = 10, color = '#3b82f6', bgColor = '#e2e8f0', theme }) => {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  // Permitir valores superiores al 100%
  const progressValue = Math.min(value, 200); // Máximo 200% para evitar overflow visual
  // Si está en 100% o más, completar el círculo
  const offset = progressValue >= 100 ? 0 : circ - (progressValue / 100) * circ;
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
        {`${Math.round(Math.min(value, 200))}%`}
      </text>
    </svg>
  );
};

const KpiMetaCard = ({
  value = 75,
  currentValue = 0,
  targetValue = 500000,
  percentage = 0,
  title = 'Meta de Ventas',
  subtitle = 'Objetivo Mensual',
  description = 'Progreso respecto a la meta establecida para este mes.'
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [metaData, setMetaData] = useState({
    ventasActuales: 0,
    meta: 500000, // Meta fija de $500,000
    porcentajeCumplimiento: 0,
    faltante: 0
  });

  useEffect(() => {
    // Calcular el porcentaje directamente desde los valores actuales/meta
    const meta = targetValue;
    const ventasActuales = currentValue;
    const porcentajeCumplimiento = meta > 0 ? (ventasActuales / meta) * 100 : 0;
    const faltante = meta - ventasActuales;

    setMetaData({
      ventasActuales,
      meta,
      porcentajeCumplimiento,
      faltante
    });
    setLoading(false);
  }, [currentValue, targetValue, percentage]);

  const formatValue = (val) => {
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(1)}M`;
    } else if (val >= 1000) {
      return `$${(val / 1000).toFixed(1)}K`;
    } else {
      return `$${val.toLocaleString('es-CL')}`;
    }
  };
  
  // Determinar el color según el progreso
  const getProgressColor = (progress) => {
    if (progress < 60) return '#7c2d12'; // Marrón oscuro
    if (progress < 80) return '#92400e'; // Marrón medio
    if (progress < 95) return '#1e40af'; // Azul
    if (progress < 100) return '#10b981'; // Verde
    if (progress < 120) return '#059669'; // Verde oscuro
    return '#047857'; // Verde muy oscuro para >120%
  };

  const progressColor = getProgressColor(metaData.porcentajeCumplimiento);
  
  if (loading) {
    return (
      <Box sx={{
        background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.90)',
        borderRadius: '18px',
        border: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.085)' : '1px solid rgba(0,0,0,0.07)',
        backdropFilter: 'blur(20px)',
        padding: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
      }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
          Cargando...
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{
      position: 'relative',
      overflow: 'hidden',
      background: theme.palette.mode === 'dark'
        ? 'rgba(255,255,255,0.04)'
        : 'rgba(255,255,255,0.90)',
      borderRadius: '18px',
      padding: 3,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      border: theme.palette.mode === 'dark'
        ? '1px solid rgba(255,255,255,0.085)'
        : '1px solid rgba(0,0,0,0.07)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      boxShadow: theme.palette.mode === 'dark'
        ? '0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.38), 0 12px 40px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)'
        : '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)',
      transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.32s ease',
      '&:hover': {
        transform: 'translateY(-6px)',
        boxShadow: theme.palette.mode === 'dark'
          ? `0 2px 4px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.45), 0 20px 60px rgba(6,182,212,0.1), 0 0 0 1px rgba(6,182,212,0.18), inset 0 1px 0 rgba(255,255,255,0.08)`
          : `0 4px 12px rgba(0,0,0,0.08), 0 12px 40px rgba(8,145,178,0.14), 0 0 0 1px rgba(8,145,178,0.15)`,
      },
      /* Subtle progress-color accent on top border */
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0, left: '15%', right: '15%',
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${progressColor}55, transparent)`,
      },
    }}>
      <div style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        color: theme.palette.text.secondary,
        marginBottom: 16,
        textAlign: 'center',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        WebkitFontSmoothing: 'antialiased',
        position: 'relative',
        zIndex: 2,
      }}>
        {title}
      </div>
      
      <div style={{ position: 'relative', zIndex: 2 }}>
        <CircularProgressBar value={metaData.porcentajeCumplimiento} color={progressColor} theme={theme} />
      </div>
      
      <Typography 
        variant="body2" 
        sx={{ 
          color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.8)' : theme.palette.text.secondary,
          fontWeight: 500,
          fontSize: '0.95rem',
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
            width: `${Math.min(metaData.porcentajeCumplimiento, 200)}%`,
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
          fontSize: '0.85rem',
          textAlign: 'center',
          lineHeight: 1.4,
          position: 'relative',
          zIndex: 2,
          mb: 1
        }}
      >
        {description}
      </Typography>

      {/* Información adicional de ventas actuales y faltante */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        width: '100%', 
        mt: 1,
        position: 'relative',
        zIndex: 2
      }}>
        <Typography 
          variant="caption" 
          sx={{ 
            fontSize: '0.75rem',
            color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'text.secondary',
            fontWeight: 500
          }}
        >
          Meta: {formatValue(metaData.meta)}
        </Typography>
        <Typography 
          variant="caption" 
          sx={{ 
            fontSize: '0.75rem',
            color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'text.secondary',
            fontWeight: 500
          }}
        >
          Actual: {formatValue(metaData.ventasActuales)}
        </Typography>
      </Box>
    </Box>
  );
};

export default KpiMetaCard; 