import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { getVentasSemanales } from '../services/api';
import { glassCardSx } from '../utils/glassCard';

const ACCENT = '#06b6d4';

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
    ventas_semana_pasada: 0,
    pedidos_semana_actual: 0,
    pedidos_semana_pasada: 0,
    porcentaje_cambio: percentageChange,
    es_positivo: isPositive
  });
  const [loading, setLoading] = useState(false);
  
  const fetchVentasSemanales = async () => {
    try {
      setLoading(true);
      const data = await getVentasSemanales();
      setVentasData({
        ventas_semana_actual: data.ventas_semana_actual || 0,
        ventas_semana_pasada: data.ventas_semana_pasada || 0,
        pedidos_semana_actual: data.pedidos_semana_actual || 0,
        pedidos_semana_pasada: data.pedidos_semana_pasada || 0,
        porcentaje_cambio: data.porcentaje_cambio || 0,
        es_positivo: data.es_positivo !== undefined ? data.es_positivo : true
      });
    } catch (error) {
      console.error('Error obteniendo ventas semanales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVentasSemanales();
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

  // Generar puntos del gráfico de tendencia semanal
  const generarPuntosGrafico = () => {
    // Simular tendencia basada en los datos de ventas
    const ventasActual = ventasData.ventas_semana_actual;
    const ventasPasada = ventasData.ventas_semana_pasada;
    
    if (ventasActual === 0 && ventasPasada === 0) {
      return "M0 30 Q20 20 40 25 T80 15 T120 20 T160 10 T200 15";
    }
    
    // Crear puntos que reflejen la tendencia
    const puntos = [];
    const maxVentas = Math.max(ventasActual, ventasPasada);
    
    for (let i = 0; i < 7; i++) {
      const x = (i / 6) * 200;
      // Simular variación diaria
      const variacion = Math.sin(i * 0.5) * 0.3 + 0.7;
      const y = 40 - (variacion * 30);
      puntos.push(`${x} ${y}`);
    }
    
    return `M${puntos.join(' L')}`;
  };

  const tooltipText = `Ventas semanales:
Semana actual: ${formatValue(ventasData.ventas_semana_actual)}
Semana pasada: ${formatValue(ventasData.ventas_semana_pasada)}
Pedidos actual: ${ventasData.pedidos_semana_actual}
Pedidos pasada: ${ventasData.pedidos_semana_pasada}
Cambio: ${ventasData.es_positivo ? '+' : ''}${ventasData.porcentaje_cambio}%`;

  return (
    <Box
      sx={{
        ...glassCardSx(theme, ACCENT),
        padding: 3,
        color: theme.palette.text.primary,
        cursor: 'pointer',
        minHeight: 180,
        height: '100%',
      }}
      onClick={fetchVentasSemanales}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography 
            variant="body1" 
            sx={{ 
              fontWeight: 700, 
              color: theme.palette.text.primary, 
              mb: 1.5,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: '1rem', // Estandarizado a 1rem
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              textRendering: 'optimizeLegibility',
              fontFeatureSettings: '"liga" 1, "kern" 1',
              fontDisplay: 'swap'
            }}
          >
            {title}
            {loading && <Typography component="span" sx={{ ml: 1, fontSize: '0.8rem', color: ACCENT }}>🔄</Typography>}
          </Typography>
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 800, 
              mb: 1,
              color: theme.palette.text.primary,
              lineHeight: 1.1,
              fontSize: '2.5rem', // Estandarizado a 2.5rem
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              textRendering: 'optimizeLegibility',
              fontFeatureSettings: '"liga" 1, "kern" 1, "tnum" 1',
              fontDisplay: 'swap'
            }}
          >
            {formatValue(ventasData.ventas_semana_actual)}
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.8)' : theme.palette.text.secondary,
              fontWeight: 500,
              fontSize: '0.9rem', // Estandarizado a 0.9rem
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              textRendering: 'optimizeLegibility',
              fontFeatureSettings: '"liga" 1, "kern" 1',
              fontDisplay: 'swap'
            }}
          >
            {subtitle}
          </Typography>
        </Box>
        <Tooltip 
          title={tooltipText}
          placement="top"
          arrow
        >
          <Chip
            label={`${ventasData.es_positivo ? '+' : ''}${ventasData.porcentaje_cambio.toFixed(1)}%`}
            sx={{
              background: ventasData.es_positivo
                ? (theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.1)')
                : (theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.1)'),
              color: ventasData.es_positivo ? '#059669' : '#dc2626',
              fontWeight: 600,
              border: `1px solid ${ventasData.es_positivo ? 'rgba(5, 150, 105, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
              fontSize: '0.9rem', // Estandarizado a 0.9rem
              height: 'auto',
              cursor: 'help',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              textRendering: 'optimizeLegibility',
              fontFeatureSettings: '"liga" 1, "kern" 1',
              fontDisplay: 'swap',
              '& .MuiChip-label': {
                padding: '8px 12px',
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
                textRendering: 'optimizeLegibility'
              }
            }}
          />
        </Tooltip>
      </Box>
      
      {/* Gráfico de tendencia semanal */}
      <Box sx={{ 
        width: '100%', 
        height: 40, 
        mt: 2,
        position: 'relative'
      }}>
        <svg width="100%" height="40" style={{ overflow: 'visible' }}>
          <path
            d={generarPuntosGrafico()}
            stroke={ACCENT}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`${generarPuntosGrafico()} L200 40 L0 40 Z`}
            fill="url(#ventas-semanales-grad)"
            opacity="0.3"
          />
          <defs>
            <linearGradient id="ventas-semanales-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.6"/>
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0.1"/>
            </linearGradient>
          </defs>
        </svg>
        
        {/* Etiquetas de días de la semana */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          mt: 0.5,
          px: 1
        }}>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((dia, index) => (
            <Typography 
              key={index}
              variant="caption" 
              sx={{ 
                fontSize: '0.75rem', // Estandarizado a 0.75rem
                color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                fontWeight: 500,
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
                textRendering: 'optimizeLegibility',
                fontFeatureSettings: '"liga" 1, "kern" 1',
                fontDisplay: 'swap'
              }}
            >
              {dia}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default VentasSemanalesCard; 