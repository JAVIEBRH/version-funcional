import React, { memo } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
  ComposedChart, ReferenceLine,
} from 'recharts';

/* ── Custom Tooltip ──────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label, isDark }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      px: 2, py: 1.5,
      borderRadius: '12px',
      background: isDark ? 'rgba(4,10,20,0.97)' : 'rgba(255,255,255,0.98)',
      border: isDark
        ? '1px solid rgba(6,182,212,0.22)'
        : '1px solid rgba(8,145,178,0.18)',
      boxShadow: isDark
        ? '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(6,182,212,0.08)'
        : '0 8px 28px rgba(0,0,0,0.14)',
      backdropFilter: 'blur(16px)',
      minWidth: 120,
    }}>
      <Typography sx={{
        fontSize: '0.67rem', fontWeight: 700,
        color: isDark ? '#475569' : '#94a3b8',
        mb: 0.75, textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      }}>
        {label}
      </Typography>
      {payload.map((entry, i) => (
        <Typography key={i} sx={{
          fontSize: '0.95rem', fontWeight: 800,
          color: entry.color || (isDark ? '#06b6d4' : '#0891b2'),
          fontVariantNumeric: 'tabular-nums',
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          letterSpacing: '-0.02em',
        }}>
          {entry.name === 'ventas'  ? `$${Number(entry.value).toLocaleString('es-CL')}` :
           entry.name === 'litros' ? `${entry.value}L` :
           entry.value}
        </Typography>
      ))}
    </Box>
  );
};

const ChartCard = ({ title, data, type = 'line', height = 300 }) => {
  const theme  = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const cyan   = '#06b6d4';
  const violet = '#0d9488';
  const gridColor  = isDark ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.045)';
  const axisColor  = isDark ? 'rgba(255,255,255,0.08)'  : 'rgba(0,0,0,0.08)';
  const tickColor  = isDark ? '#475569' : '#94a3b8';

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={cyan} stopOpacity={isDark ? 0.22 : 0.14} />
                <stop offset="95%" stopColor={cyan} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridColor} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: tickColor, fontSize: 11, fontWeight: 600, fontFamily: '"DM Sans", system-ui, sans-serif' }}
              axisLine={{ stroke: axisColor }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: tickColor, fontSize: 11, fontWeight: 600, fontFamily: '"DM Sans", system-ui, sans-serif' }}
              axisLine={false}
              tickLine={false}
              width={58}
              tickFormatter={v => `$${(v/1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip isDark={isDark} />} />
            <Area
              type="monotone"
              dataKey="ventas"
              stroke={cyan}
              strokeWidth={2.8}
              fill="url(#chart-area-grad)"
              dot={false}
              activeDot={{ r: 5, fill: cyan, strokeWidth: 0, style: { filter: `drop-shadow(0 0 6px ${cyan})` } }}
            />
          </AreaChart>
        );

      case 'bar': {
        const fmtMoney = v => {
          if (v == null) return '';
          return v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : `$${(v/1000).toFixed(0)}k`;
        };
        const trendColor = isDark ? '#f59e0b' : '#d97706';
        return (
          <ComposedChart data={data} barSize={18}>
            <defs>
              <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={isDark ? cyan   : '#0891b2'} stopOpacity="1"  />
                <stop offset="100%" stopColor={isDark ? violet : '#7c3aed'} stopOpacity="0.7" />
              </linearGradient>
              <linearGradient id="bar-proj-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={isDark ? cyan   : '#0891b2'} stopOpacity="0.35" />
                <stop offset="100%" stopColor={isDark ? violet : '#7c3aed'} stopOpacity="0.15" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={gridColor} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: tickColor, fontSize: 11, fontWeight: 600, fontFamily: '"DM Sans", system-ui, sans-serif' }}
              axisLine={{ stroke: axisColor }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: tickColor, fontSize: 11, fontWeight: 600, fontFamily: '"DM Sans", system-ui, sans-serif' }}
              axisLine={false}
              tickLine={false}
              width={62}
              tickFormatter={fmtMoney}
            />
            <Tooltip content={<CustomTooltip isDark={isDark} />} />
            <Bar dataKey="ventas" radius={[6, 6, 2, 2]} fill="url(#bar-grad)" name="ventas" />
            <Bar dataKey="ventas_proyectadas" radius={[6, 6, 2, 2]} fill="url(#bar-proj-grad)" name="proyección mes" />
            <Line
              dataKey="tendencia"
              name="tendencia"
              type="monotone"
              stroke={trendColor}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 3, fill: trendColor, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: trendColor, strokeWidth: 0 }}
              connectNulls={false}
            />
          </ComposedChart>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Box sx={{
      position: 'relative',
      overflow: 'hidden',
      borderRadius: '18px',
      padding: '24px 22px 18px',

      background: isDark
        ? 'rgba(255,255,255,0.038)'
        : 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',

      border: isDark
        ? '1px solid rgba(255,255,255,0.085)'
        : '1px solid rgba(0,0,0,0.07)',

      boxShadow: isDark
        ? '0 2px 4px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.3), 0 16px 56px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.055)'
        : '0 2px 4px rgba(0,0,0,0.04), 0 8px 28px rgba(0,0,0,0.07)',

      transition: 'border-color 0.32s ease, box-shadow 0.32s ease',
      '&:hover': {
        borderColor: isDark ? 'rgba(6,182,212,0.2)' : 'rgba(8,145,178,0.18)',
        boxShadow: isDark
          ? '0 4px 8px rgba(0,0,0,0.5), 0 12px 48px rgba(6,182,212,0.08), 0 0 0 1px rgba(6,182,212,0.1)'
          : '0 8px 32px rgba(8,145,178,0.1)',
      },

      /* Mesh gradient accent — top-right corner */
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 0, right: 0,
        width: 200, height: 200,
        background: isDark
          ? 'radial-gradient(circle at top right, rgba(6,182,212,0.045) 0%, transparent 60%)'
          : 'radial-gradient(circle at top right, rgba(8,145,178,0.04) 0%, transparent 60%)',
        pointerEvents: 'none',
        borderRadius: 'inherit',
      },
    }}>
      {/* Title bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, position: 'relative', zIndex: 1 }}>
        {/* Dual-color accent line */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
          <Box sx={{ width: 3, height: 10, borderRadius: '99px', bgcolor: cyan,   opacity: 0.9 }} />
          <Box sx={{ width: 3, height:  6, borderRadius: '99px', bgcolor: violet, opacity: 0.6 }} />
        </Box>
        <Typography sx={{
          fontWeight: 700,
          fontSize: '0.9rem',
          color: theme.palette.text.primary,
          letterSpacing: '-0.015em',
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        }}>
          {title}
        </Typography>
      </Box>

      {/* Chart */}
      <Box sx={{ width: '100%', height, position: 'relative', zIndex: 1 }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default memo(ChartCard);
