import React, { memo } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import { formatCurrency, formatNumber } from '../utils/formatters';

/* ── Stable sparkline paths ─────────────────────────────────────── */
const SPARK_UP   = 'M0 18 C18 12 36 15 54 9 C72 3 90 8 120 4 C136 2 148 5 160 3';
const SPARK_DOWN = 'M0 5 C18 8 36 4 54 10 C72 16 90 12 120 16 C136 18 148 14 160 18';
const FILL_UP    = `${SPARK_UP} L160 22 L0 22 Z`;
const FILL_DOWN  = `${SPARK_DOWN} L160 22 L0 22 Z`;

// Construye un path real a partir de una serie de datos (últimos N días).
// Si no hay datos suficientes, cae a la curva decorativa fija.
const buildTrendPath = (trendData, isPositive) => {
  if (!trendData || trendData.length < 2 || trendData.every(v => v === trendData[0])) {
    return {
      line: isPositive ? SPARK_UP : SPARK_DOWN,
      fill: isPositive ? FILL_UP : FILL_DOWN,
      endY: isPositive ? 3 : 18,
    };
  }
  const max = Math.max(...trendData);
  const min = Math.min(...trendData, 0);
  const range = (max - min) || 1;
  const coords = trendData.map((v, i) => {
    const x = (i / (trendData.length - 1)) * 160;
    const y = 20 - ((v - min) / range) * 18;
    return [x, y];
  });
  const line = 'M' + coords.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L');
  const fill = `${line} L160 22 L0 22 Z`;
  return { line, fill, endY: coords[coords.length - 1][1] };
};

const FinancialKpiCard = ({
  title      = 'Ticket Promedio',
  value      = 0,
  subtitle   = 'Por pedido',
  icon       = '💰',
  trend      = '+5.2%',
  isPositive = true,
  trendData  = null,
}) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const formatValue = (val) =>
    title === 'Ticket Promedio' ? formatCurrency(val) : formatNumber(val);

  const cyan    = isDark ? '#06b6d4' : '#0891b2';
  const positiveColor = '#10b981';
  const negativeColor = '#ef4444';
  const trendColor    = isPositive ? positiveColor : negativeColor;
  const sparkColor    = isPositive ? positiveColor : negativeColor;
  const { line: sparkLine, fill: sparkFill, endY } = buildTrendPath(trendData, isPositive);

  return (
    <Box
      className="card-float-in"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '16px',
        padding: '20px 18px 16px',
        cursor: 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',

        /* Glass surface */
        background: isDark
          ? 'rgba(255,255,255,0.036)'
          : 'rgba(255,255,255,0.90)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',

        border: isDark
          ? '1px solid rgba(255,255,255,0.085)'
          : '1px solid rgba(0,0,0,0.07)',

        boxShadow: isDark
          ? '0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.35), 0 10px 36px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.055)'
          : '0 1px 3px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.07)',

        transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.32s ease, border-color 0.32s ease',
        '&:hover': {
          transform: 'translateY(-6px)',
          borderColor: isDark ? 'rgba(6,182,212,0.28)' : 'rgba(8,145,178,0.22)',
          boxShadow: isDark
            ? `0 2px 4px rgba(0,0,0,0.5), 0 8px 28px rgba(0,0,0,0.42), 0 16px 56px rgba(6,182,212,0.1), 0 0 0 1px rgba(6,182,212,0.16), inset 0 1px 0 rgba(255,255,255,0.07)`
            : `0 4px 12px rgba(0,0,0,0.08), 0 10px 36px rgba(8,145,178,0.12), 0 0 0 1px rgba(8,145,178,0.13)`,
        },

        /* Top glow line */
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: '20%', right: '20%',
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${cyan}44, transparent)`,
        },
      }}
    >
      {/* Header: label + trend */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {/* Icon glyph */}
          <Box sx={{
            fontSize: '0.95rem',
            lineHeight: 1,
            opacity: 0.85,
          }}>
            {icon}
          </Box>
          <Typography sx={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: theme.palette.text.secondary,
            lineHeight: 1.2,
            maxWidth: '64%',
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          }}>
            {title}
          </Typography>
        </Box>

        {/* Trend pill */}
        <Box sx={{
          px: 1, py: 0.3,
          borderRadius: '8px',
          background: isPositive
            ? isDark ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.10)'
            : isDark ? 'rgba(239,68,68,0.14)'  : 'rgba(239,68,68,0.10)',
          border: `1px solid ${isPositive
            ? isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)'
            : isDark ? 'rgba(239,68,68,0.3)'  : 'rgba(239,68,68,0.2)'}`,
          flexShrink: 0,
          display: 'flex', alignItems: 'center',
        }}>
          <Typography sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: trendColor,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          }}>
            {isPositive ? '↑' : '↓'} {trend}
          </Typography>
        </Box>
      </Box>

      {/* Main value */}
      <Typography sx={{
        fontWeight: 800,
        fontSize: '1.8rem',
        lineHeight: 1,
        letterSpacing: '-0.04em',
        color: theme.palette.text.primary,
        fontVariantNumeric: 'tabular-nums',
        fontFeatureSettings: '"tnum" 1',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        mb: 0.5,
      }}>
        {formatValue(value)}
      </Typography>

      {/* Subtitle */}
      <Typography sx={{
        fontSize: '0.73rem',
        color: theme.palette.text.secondary,
        fontWeight: 500,
        mb: 'auto',
        pb: 1,
        lineHeight: 1.3,
        fontFamily: '"DM Sans", system-ui, sans-serif',
      }}>
        {subtitle}
      </Typography>

      {/* Mini sparkline */}
      <Box sx={{ width: '100%', height: 22, mt: 0.5, opacity: isDark ? 0.7 : 0.52 }}>
        <svg width="100%" height="22" viewBox="0 0 160 22" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={`fkpi-grad-${title.replace(/\s/g,'')}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor={sparkColor} stopOpacity="0.38" />
              <stop offset="100%" stopColor={sparkColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>
          <path
            d={sparkFill}
            fill={`url(#fkpi-grad-${title.replace(/\s/g,'')})`}
          />
          <path
            d={sparkLine}
            stroke={sparkColor}
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Endpoint dot */}
          <circle cx="160" cy={endY} r="2.5" fill={sparkColor} opacity="0.85" />
          <circle cx="160" cy={endY} r="5"   fill={sparkColor} opacity="0.15" />
        </svg>
      </Box>
    </Box>
  );
};

export default memo(FinancialKpiCard);
