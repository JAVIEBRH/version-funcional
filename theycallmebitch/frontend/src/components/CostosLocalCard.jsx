import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

const CostosLocalCard = ({ 
  title = 'Costos', 
  subtitle = 'Costos de lo que va del mes de los bidones vendidos en el local'
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    costos: 0,
    costosMesAnterior: 0,
    porcentajeCambio: 0,
    esPositivo: true,
    costoPorBidon: 60.69,
    tendenciaMensual: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('https://fluvi.cl/apilian/api_eventalocal.php');
        const result = await response.json();
        
        if (result.status === 'success' && result.data) {
          const fechaActual = new Date();
          const mesActual = fechaActual.getMonth();
          const anioActual = fechaActual.getFullYear();
          
          const COSTO_TAPA_POR_BIDON = 60.69; // Costo de tapa por bidón (con IVA)
          
          let costos = 0;
          let costosMesAnterior = 0;

          result.data.forEach(venta => {
            const precio = parseInt(venta.precio);
            const fechaVenta = new Date(venta.fecha.split('-').reverse().join('-'));
            
            // Calcular bidones basado en la promoción acumulable (3 bidones por $5,000)
            const bidones = Math.floor(precio / 5000) * 3; // Cada $5,000 = 3 bidones
            const costoVenta = bidones * COSTO_TAPA_POR_BIDON;
            
            // Costos del mes actual
            if (fechaVenta.getMonth() === mesActual && fechaVenta.getFullYear() === anioActual) {
              costos += costoVenta;
            }
            
            // Costos del mes anterior
            if (fechaVenta.getMonth() === (mesActual - 1) && fechaVenta.getFullYear() === anioActual) {
              costosMesAnterior += costoVenta;
            }
          });

          const porcentajeCambio = costosMesAnterior > 0 
            ? ((costos - costosMesAnterior) / costosMesAnterior) * 100 
            : 0;

          // Generar tendencia mensual simulada
          const tendenciaMensual = [
            { mes: 'Ene', costos: costos * 0.8 },
            { mes: 'Feb', costos: costos * 0.85 },
            { mes: 'Mar', costos: costos * 0.9 },
            { mes: 'Abr', costos: costos * 0.92 },
            { mes: 'May', costos: costos * 0.95 },
            { mes: 'Jun', costos: costos * 0.98 },
            { mes: 'Jul', costos: costos }
          ];

          setData({
            costos,
            costosMesAnterior,
            porcentajeCambio,
            esPositivo: porcentajeCambio >= 0,
            costoPorBidon: COSTO_TAPA_POR_BIDON,
            tendenciaMensual
          });
        }
      } catch (error) {
        console.error('Error obteniendo datos de costos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
    if (!data.tendenciaMensual || data.tendenciaMensual.length === 0) {
      return "M0 30 Q20 20 40 25 T80 15 T120 20 T160 10 T200 15";
    }
    
    const puntos = data.tendenciaMensual.map((mes, index) => {
      const x = (index / (data.tendenciaMensual.length - 1)) * 200;
      const maxCostos = Math.max(...data.tendenciaMensual.map(m => m.costos));
      const y = maxCostos > 0 ? 40 - (mes.costos / maxCostos) * 30 : 30;
      return `${x} ${y}`;
    });
    
    return `M${puntos.join(' L')}`;
  };

  const tooltipText = `Costos locales:
Este mes: ${formatValue(data.costos)}
Mes anterior: ${formatValue(data.costosMesAnterior)}
Costo por tapa: $${data.costoPorBidon.toLocaleString('es-CL')}
Cambio: ${data.esPositivo ? '+' : ''}${data.porcentajeCambio.toFixed(1)}%`;

  if (loading) {
    return (
      <Box
        sx={{
          background: theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
            : 'linear-gradient(135deg, #f8f9ff 0%, #e8eaff 100%)',
          borderRadius: 3,
          padding: 3,
          color: theme.palette.text.primary,
          boxShadow: theme.palette.mode === 'dark' 
            ? '0 4px 20px rgba(0, 0, 0, 0.3)'
            : '0 4px 20px rgba(0, 0, 0, 0.08)',
          transition: 'all 0.3s ease',
          minHeight: 180,
          border: `1px solid ${theme.palette.mode === 'dark' 
            ? 'rgba(147, 112, 219, 0.2)' 
            : 'rgba(147, 112, 219, 0.1)'}`,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Typography variant="body2" sx={{ color: '#9370db' }}>
          Cargando costos...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        background: theme.palette.mode === 'dark' 
          ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
          : 'linear-gradient(135deg, #f8f9ff 0%, #e8eaff 100%)',
        borderRadius: 3,
        padding: 3,
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
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.palette.mode === 'dark' 
            ? '0 8px 30px rgba(0, 0, 0, 0.4)'
            : '0 8px 30px rgba(0, 0, 0, 0.12)'
        }
      }}
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
            {formatValue(data.costos)}
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
            label={`${data.esPositivo ? '+' : ''}${data.porcentajeCambio.toFixed(1)}%`}
            sx={{
              background: theme.palette.mode === 'dark' 
                ? 'rgba(147, 112, 219, 0.2)' 
                : 'rgba(147, 112, 219, 0.1)',
              color: data.esPositivo ? '#059669' : '#dc2626',
              fontWeight: 600,
              border: `1px solid ${data.esPositivo ? 'rgba(5, 150, 105, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
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
            stroke="#9370db"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`${generarPuntosGrafico()} L200 40 L0 40 Z`}
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
        
        {/* Etiquetas de meses */}
        {data.tendenciaMensual && data.tendenciaMensual.length > 0 && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            mt: 0.5,
            px: 1
          }}>
            {data.tendenciaMensual.slice(-6).map((mes, index) => (
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

export default CostosLocalCard;
