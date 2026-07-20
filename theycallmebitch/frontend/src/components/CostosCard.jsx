import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { getVentasHistoricas } from '../services/api';
import { glassCardSx } from '../utils/glassCard';

const ACCENT = '#ef4444';

const CostosCard = ({ 
  title = 'Costos', 
  value = 8500000, 
  subtitle = 'Este mes',
  percentageChange = -5.2,
  isPositive = false 
}) => {
  const theme = useTheme();
  const [costosData, setCostosData] = useState({
    costos_mes_actual: value,
    costos_mes_anterior: 0,
    porcentaje_cambio: percentageChange,
    es_positivo: isPositive,
    tendencia_mensual: [],
    fecha_analisis: ''
  });
  const [loading, setLoading] = useState(false);
  
  const fetchCostosMensuales = async () => {
    try {
      setLoading(true);
      const data = await getVentasHistoricas();
      
      // Obtener el mes actual y anterior
      const hoy = new Date();
      const mesActual = hoy.getMonth();
      const anioActual = hoy.getFullYear();
      
      // Mapear nombres de meses a números
      const mesesMap = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      // Encontrar costos del mes actual (usando ventas como proxy para costos)
      const costosMesActual = data.find(item => {
        const mesNumero = mesesMap[item.name];
        return mesNumero === mesActual && item.ventas > 0;
      });
      
      // Encontrar costos del mes anterior
      const mesAnterior = mesActual === 0 ? 11 : mesActual - 1;
      const anioAnterior = mesActual === 0 ? anioActual - 1 : anioActual;
      const costosMesAnterior = data.find(item => {
        const mesNumero = mesesMap[item.name];
        return mesNumero === mesAnterior && item.ventas > 0;
      });
      
      // Derivar una razón costo/venta real a partir del costo real del mes (prop "value")
      // en vez de asumir un 60% fijo sin base en los datos.
      const ventasActualMes = costosMesActual?.ventas || 0;
      const razonCostoVenta = ventasActualMes > 0 && value > 0 ? value / ventasActualMes : 0.6;
      const costosAnterior = costosMesAnterior?.ventas ? costosMesAnterior.ventas * razonCostoVenta : 0;

      // Generar tendencia mensual basada en datos históricos reales de ventas
      const tendenciaMensual = [];
      const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

      // Obtener los últimos 6 meses de datos
      for (let i = 5; i >= 0; i--) {
        const mesIndex = (mesActual - i + 12) % 12;
        const anio = mesActual - i < 0 ? anioActual - 1 : anioActual;

        const ventasMes = data.find(item => {
          const mesNumero = mesesMap[item.name];
          return mesNumero === mesIndex && item.ventas > 0;
        });

        const costosMes = ventasMes?.ventas ? ventasMes.ventas * razonCostoVenta : 0;

        tendenciaMensual.push({
          mes: mesesNombres[mesIndex],
          costos: costosMes
        });
      }

      // El valor y porcentaje reales vienen del backend vía props (/kpis);
      // aquí solo enriquecemos con el mes anterior y la tendencia para el gráfico.
      setCostosData(prev => ({
        ...prev,
        costos_mes_anterior: costosAnterior,
        tendencia_mensual: tendenciaMensual,
        fecha_analisis: hoy.toISOString()
      }));
    } catch (error) {
      console.error('Error obteniendo costos mensuales:', error);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar cuando cambie el prop del backend
  useEffect(() => {
    if (value > 0) {
      setCostosData(prev => ({
        ...prev,
        costos_mes_actual: value,
        porcentaje_cambio: percentageChange,
        es_positivo: isPositive
      }));
    }
  }, [value, percentageChange, isPositive]);

  // Cargar tendencia histórica real al montar
  useEffect(() => {
    fetchCostosMensuales();
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

  // Generar puntos del gráfico de tendencia mensual
  const generarPuntosGrafico = () => {
    if (!costosData.tendencia_mensual || costosData.tendencia_mensual.length === 0) {
      return "M0 30 Q20 20 40 25 T80 15 T120 20 T160 10 T200 15";
    }
    
    const puntos = costosData.tendencia_mensual.map((mes, index) => {
      const x = (index / (costosData.tendencia_mensual.length - 1)) * 200;
      const maxCostos = Math.max(...costosData.tendencia_mensual.map(m => m.costos));
      const y = maxCostos > 0 ? 40 - (mes.costos / maxCostos) * 30 : 30;
      return `${x} ${y}`;
    });
    
    return `M${puntos.join(' L')}`;
  };

  const tooltipText = `Costos mensuales:
Mes actual: ${formatValue(costosData.costos_mes_actual)}
Mes anterior: ${formatValue(costosData.costos_mes_anterior)}
Cambio: ${costosData.porcentaje_cambio > 0 ? '+' : ''}${costosData.porcentaje_cambio.toFixed(1)}%
Gráfico: Últimos 6 meses`;

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
      onClick={fetchCostosMensuales}
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
              fontSize: '1rem',
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
              fontSize: '2.5rem',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              textRendering: 'optimizeLegibility',
              fontFeatureSettings: '"liga" 1, "kern" 1, "tnum" 1',
              fontDisplay: 'swap'
            }}
          >
            {formatValue(costosData.costos_mes_actual)}
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.8)' : theme.palette.text.secondary,
              fontWeight: 500,
              fontSize: '0.9rem',
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
            label={`${costosData.porcentaje_cambio > 0 ? '+' : ''}${costosData.porcentaje_cambio.toFixed(1)}%`}
            sx={{
              background: costosData.es_positivo
                ? (theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.1)')
                : (theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.1)'),
              color: costosData.es_positivo ? '#059669' : '#dc2626',
              fontWeight: 600,
              border: `1px solid ${costosData.es_positivo ? 'rgba(5, 150, 105, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
              fontSize: '0.9rem',
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
      
      {/* Gráfico de tendencia mensual */}
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
            fill="url(#costos-grad)"
            opacity="0.3"
          />
          <defs>
            <linearGradient id="costos-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={ACCENT} stopOpacity="0.6"/>
              <stop offset="100%" stopColor={ACCENT} stopOpacity="0.1"/>
            </linearGradient>
          </defs>
        </svg>
        
        {/* Etiquetas de meses */}
        {costosData.tendencia_mensual && costosData.tendencia_mensual.length > 0 && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            mt: 0.5,
            px: 1
          }}>
            {costosData.tendencia_mensual.map((mes, index) => (
              <Typography 
                key={index}
                variant="caption" 
                sx={{ 
                  fontSize: '0.75rem',
                  color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                  fontWeight: 500,
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeLegibility',
                  fontFeatureSettings: '"liga" 1, "kern" 1'
                }}
              >
                {mes.mes}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CostosCard; 