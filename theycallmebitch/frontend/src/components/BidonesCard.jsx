import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { getPedidos } from '../services/api';
import { glassCardSx } from '../utils/glassCard';

const ACCENT = '#0ea5e9';

const BidonesCard = ({ 
  title = 'Bidones Vendidos', 
  value = 0, 
  subtitle = 'Este mes',
  percentageChange = 0,
  isPositive = true 
}) => {
  const theme = useTheme();
  const [bidonesData, setBidonesData] = useState({
    total_bidones: value,
    bidones_mes_actual: value,
    bidones_mes_anterior: 0,
    porcentaje_cambio: percentageChange,
    es_positivo: isPositive,
    tendencia_diaria: [],
    fecha_analisis: ''
  });
  const [loading, setLoading] = useState(false);
  
  // Actualizar datos cuando cambien los props
  useEffect(() => {
    setBidonesData(prev => ({
      ...prev,
      total_bidones: value,
      bidones_mes_actual: value,
      porcentaje_cambio: percentageChange,
      es_positivo: isPositive
    }));
  }, [value, percentageChange, isPositive]);
  
  const fetchBidonesData = async () => {
    try {
      setLoading(true);
      const pedidos = await getPedidos();
      
      // Calcular bidones del mes actual
      const hoy = new Date();
      const mesActual = hoy.getMonth();
      const anioActual = hoy.getFullYear();
      
      // Función para calcular bidones: usa la cantidad real del pedido (ordenpedido),
      // igual que el backend; solo si falta ese dato se aproxima por precio.
      const calcularBidones = (pedido) => {
        if (pedido.ordenpedido !== undefined && pedido.ordenpedido !== null) {
          const cantidad = parseInt(String(pedido.ordenpedido).replace(/[^\d]/g, ''), 10);
          if (!isNaN(cantidad) && cantidad > 0) return cantidad;
        }
        const precioNum = parseInt(pedido.precio) || 0;
        return Math.max(1, Math.floor(precioNum / 2000));
      };
      
      // Función para parsear fecha
      const parsearFecha = (fechaStr) => {
        const partes = fechaStr.split('-');
        if (partes.length === 3) {
          return new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
        }
        return null;
      };
      
      const bidonesMesAnterior = pedidos.filter(pedido => {
        const fechaPedido = parsearFecha(pedido.fecha);
        const mesAnterior = mesActual === 0 ? 11 : mesActual - 1;
        const anioAnterior = mesActual === 0 ? anioActual - 1 : anioActual;
        return fechaPedido && fechaPedido.getMonth() === mesAnterior && fechaPedido.getFullYear() === anioAnterior;
      }).reduce((total, pedido) => total + calcularBidones(pedido), 0);
      
      // Generar tendencia diaria del mes actual
      const tendenciaDiaria = [];
      const diasEnMes = new Date(anioActual, mesActual + 1, 0).getDate();
      
      for (let dia = 1; dia <= Math.min(diasEnMes, hoy.getDate()); dia++) {
        const bidonesDia = pedidos.filter(pedido => {
          const fechaPedido = parsearFecha(pedido.fecha);
          return fechaPedido && fechaPedido.getDate() === dia && 
                 fechaPedido.getMonth() === mesActual && 
                 fechaPedido.getFullYear() === anioActual;
        }).reduce((total, pedido) => total + calcularBidones(pedido), 0);
        
        tendenciaDiaria.push({
          dia: dia,
          bidones: bidonesDia
        });
      }
      
      // El total y porcentaje reales vienen del backend vía props (/kpis);
      // aquí solo enriquecemos con el mes anterior y la tendencia diaria para el gráfico.
      setBidonesData(prev => ({
        ...prev,
        bidones_mes_anterior: bidonesMesAnterior,
        tendencia_diaria: tendenciaDiaria,
        fecha_analisis: hoy.toISOString()
      }));
    } catch (error) {
      console.error('Error obteniendo datos de bidones:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBidonesData();
    
    // Actualizar cada 10 minutos
    const interval = setInterval(fetchBidonesData, 10 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Generar puntos del gráfico de tendencia diaria
  const generarPuntosGrafico = () => {
    if (!bidonesData.tendencia_diaria || bidonesData.tendencia_diaria.length === 0) {
      return "M0 25 Q20 15 40 20 T80 10 T120 15 T160 5 T200 10";
    }
    
    const puntos = bidonesData.tendencia_diaria.map((dia, index) => {
      const x = (index / (bidonesData.tendencia_diaria.length - 1)) * 200;
      const maxBidones = Math.max(...bidonesData.tendencia_diaria.map(d => d.bidones));
      const y = maxBidones > 0 ? 40 - (dia.bidones / maxBidones) * 30 : 30;
      return `${x} ${y}`;
    });
    
    return `M${puntos.join(' L')}`;
  };

  const tooltipText = `Bidones vendidos:
Mes actual: ${bidonesData.bidones_mes_actual.toLocaleString('es-CL')}
Mes anterior: ${bidonesData.bidones_mes_anterior.toLocaleString('es-CL')}
Cambio: ${bidonesData.es_positivo ? '+' : ''}${bidonesData.porcentaje_cambio.toFixed(1)}%`;

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
      onClick={fetchBidonesData}
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
            {bidonesData.total_bidones.toLocaleString('es-CL')}
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
            label={`${bidonesData.es_positivo ? '+' : ''}${bidonesData.porcentaje_cambio.toFixed(1)}%`}
            sx={{
              background: bidonesData.es_positivo
                ? (theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.1)')
                : (theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.1)'),
              color: bidonesData.es_positivo ? '#059669' : '#dc2626',
              fontWeight: 600,
              border: `1px solid ${bidonesData.es_positivo ? 'rgba(5, 150, 105, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
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
      
      {/* Gráfico de tendencia diaria */}
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
            fill="url(#bidones-grad)"
            opacity="0.3"
          />
          <defs>
            <linearGradient id="bidones-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.6"/>
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0.1"/>
            </linearGradient>
          </defs>
        </svg>
        
        {/* Etiquetas de días */}
        {bidonesData.tendencia_diaria && bidonesData.tendencia_diaria.length > 0 && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            mt: 0.5,
            px: 1
          }}>
            {bidonesData.tendencia_diaria.slice(-6).map((dia, index) => (
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
                {dia.dia}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default BidonesCard; 