import React, { useState, useEffect, memo } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import { getVentasTotalesHistoricas } from '../services/api';
import { formatCurrency } from '../utils/formatters';

// Stable gradient IDs
const GRAD_LINE = 'ventas-line-grad';
const GRAD_FILL = 'ventas-fill-grad';

const VentasCard = ({
  title = 'Ventas Totales Históricas',
  value = 0,
  subtitle = 'Acumulado desde el inicio',
  percentageChange = 0,
  isPositive = true,
  ventasHistoricas = [],
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [ventasData, setVentasData] = useState({
    ventas_totales: value,
    total_pedidos: 0,
    porcentaje_cambio: percentageChange,
    es_positivo: isPositive,
    tendencia_mensual: [],
    fecha_analisis: '',
  });
  const [loading, setLoading] = useState(false);

  const fetchVentasHistoricas = async () => {
    try {
      setLoading(true);
      const data = await getVentasTotalesHistoricas();
      // El % de variación y el signo vienen del backend vía props (/kpis);
      // aquí solo refrescamos el total acumulado y el conteo de pedidos.
      setVentasData(prev => ({
        ...prev,
        ventas_totales: data.ventas_totales || prev.ventas_totales,
        total_pedidos: data.total_pedidos || 0,
        fecha_analisis: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error obteniendo ventas históricas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setVentasData(prev => ({
      ...prev,
      ventas_totales: value,
      porcentaje_cambio: percentageChange,
      es_positivo: isPositive,
      // Tendencia real de ventas mensuales (no una curva fabricada)
      tendencia_mensual: ventasHistoricas.length > 0
        ? ventasHistoricas.map(m => ({ mes: m.name, ventas: m.ventas }))
        : prev.tendencia_mensual,
    }));
  }, [value, percentageChange, isPositive, ventasHistoricas]);

  // Build SVG path from monthly trend data
  const buildPath = () => {
    const pts = ventasData.tendencia_mensual;
    if (!pts || pts.length < 2) return { line: 'M0 35 Q50 20 100 15 T200 10', fill: 'M0 35 Q50 20 100 15 T200 10 L200 44 L0 44 Z' };
    const maxV = Math.max(...pts.map(p => p.ventas), 1);
    const coords = pts.map((p, i) => {
      const x = (i / (pts.length - 1)) * 200;
      const y = 40 - (p.ventas / maxV) * 32;
      return [x, y];
    });
    const line = 'M' + coords.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
    const fill = line + ` L${coords[coords.length-1][0].toFixed(1)} 44 L0 44 Z`;
    return { line, fill };
  };

  const { line: pathLine, fill: pathFill } = buildPath();
  const accentColor = isDark ? '#22d3ee' : '#2563eb';
  const trendColor = ventasData.es_positivo ? '#10b981' : '#ef4444';

  const tooltipText = `Total: ${formatCurrency(ventasData.ventas_totales)}\nPedidos: ${ventasData.total_pedidos?.toLocaleString('es-CL') || 0}\nAporte del mes actual al acumulado: ${ventasData.es_positivo ? '+' : ''}${ventasData.porcentaje_cambio.toFixed(1)}%`;

  return (
    <Box
      onClick={fetchVentasHistoricas}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '16px',
        padding: '22px 22px 16px',
        minHeight: 180,
        cursor: 'pointer',
        // Glass panel
        background: isDark
          ? 'rgba(255,255,255,0.032)'
          : 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.07)',
        boxShadow: isDark
          ? '0 2px 4px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.07)',
        transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, border-color 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: isDark ? 'rgba(34,211,238,0.25)' : 'rgba(37,99,235,0.2)',
          boxShadow: isDark
            ? '0 4px 8px rgba(0,0,0,0.5), 0 12px 48px rgba(34,211,238,0.1), inset 0 1px 0 rgba(255,255,255,0.07)'
            : '0 8px 32px rgba(37,99,235,0.12)',
        },
        // Subtle shimmer line across top on hover
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: '15%', right: '15%',
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${accentColor}50, transparent)`,
          opacity: 0.8,
        },
        // Diagonal grain texture for depth
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: isDark
            ? 'linear-gradient(135deg, rgba(34,211,238,0.025) 0%, transparent 50%, rgba(167,139,250,0.02) 100%)'
            : 'linear-gradient(135deg, rgba(37,99,235,0.03) 0%, transparent 60%)',
          pointerEvents: 'none',
          borderRadius: 'inherit',
        },
      }}
    >
      {/* Header row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, position: 'relative', zIndex: 1 }}>
        <Box sx={{ flex: 1, pr: 1 }}>
          {/* Label */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
            <Typography sx={{
              fontWeight: 600,
              fontSize: '0.68rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: theme.palette.text.secondary,
              lineHeight: 1,
            }}>
              {title}
            </Typography>
            {loading && (
              <Box sx={{
                width: 6, height: 6, borderRadius: '50%',
                bgcolor: accentColor,
                animation: 'pulseOpacity 1s ease-in-out infinite',
                '@keyframes pulseOpacity': {
                  '0%,100%': { opacity: 0.3 },
                  '50%': { opacity: 1 },
                },
              }} />
            )}
          </Box>

          {/* Main value */}
          <Typography sx={{
            fontWeight: 800,
            fontSize: '2.2rem',
            lineHeight: 1,
            letterSpacing: '-0.04em',
            color: theme.palette.text.primary,
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: '"tnum" 1',
            fontFamily: '"Outfit", system-ui, sans-serif',
            mb: 0.75,
          }}>
            {formatCurrency(ventasData.ventas_totales)}
          </Typography>

          {/* Subtitle */}
          <Typography sx={{
            fontSize: '0.78rem',
            color: theme.palette.text.secondary,
            fontWeight: 500,
            lineHeight: 1.4,
          }}>
            {subtitle}
          </Typography>
        </Box>

        {/* Trend badge */}
        <Tooltip title={tooltipText} placement="top" arrow>
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5,
          }}>
            <Box sx={{
              px: 1.25, py: 0.5,
              borderRadius: '8px',
              background: ventasData.es_positivo
                ? isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.1)'
                : isDark ? 'rgba(239,68,68,0.12)'  : 'rgba(239,68,68,0.1)',
              border: `1px solid ${ventasData.es_positivo
                ? isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)'
                : isDark ? 'rgba(239,68,68,0.3)'  : 'rgba(239,68,68,0.2)'}`,
              cursor: 'help',
            }}>
              <Typography sx={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: trendColor,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {ventasData.es_positivo ? '+' : ''}{ventasData.porcentaje_cambio.toFixed(1)}%
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.62rem', color: theme.palette.text.secondary, opacity: 0.6 }}>
              aporte del mes
            </Typography>
          </Box>
        </Tooltip>
      </Box>

      {/* Sparkline */}
      <Box sx={{ width: '100%', height: 44, position: 'relative', zIndex: 1 }}>
        <svg width="100%" height="44" viewBox="0 0 200 44" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={GRAD_LINE} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor={accentColor} stopOpacity="0.5" />
              <stop offset="100%" stopColor={isDark ? '#a78bfa' : '#7c3aed'} stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id={GRAD_FILL} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor={accentColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <path d={pathFill} fill={`url(#${GRAD_FILL})`} />
          <path d={pathLine} stroke={`url(#${GRAD_LINE})`} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Box>

      {/* Month labels */}
      {ventasData.tendencia_mensual?.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.25, mt: 0.25, position: 'relative', zIndex: 1 }}>
          {ventasData.tendencia_mensual.slice(-6).map((mes, i) => (
            <Typography key={i} sx={{ fontSize: '0.62rem', color: theme.palette.text.secondary, opacity: 0.55, fontWeight: 500 }}>
              {mes.mes}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default memo(VentasCard);
