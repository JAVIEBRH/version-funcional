import React from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { glassCardSx, GLASS_FONT_HEADING, GLASS_FONT_BODY } from '../utils/glassCard';

const CYAN = '#06b6d4';
const VIOLET = '#0d9488';

const formatoCLP = (val) => `$${Math.round(val || 0).toLocaleString('es-CL')}`;

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function CustomTooltip({ active, payload, label, isDark }) {
  if (!active || !payload?.length) return null;
  const p10 = payload.find(p => p.dataKey === 'p10')?.value;
  const p50 = payload.find(p => p.dataKey === 'p50')?.value;
  const p90 = payload.find(p => p.dataKey === 'p90')?.value;
  return (
    <Box sx={{
      px: 2, py: 1.5, borderRadius: '12px',
      background: isDark ? 'rgba(4,10,20,0.97)' : 'rgba(255,255,255,0.98)',
      border: isDark ? '1px solid rgba(6,182,212,0.22)' : '1px solid rgba(8,145,178,0.18)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    }}>
      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b', mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: CYAN }}>{p50} pedidos (más probable)</Typography>
      <Typography sx={{ fontSize: '0.75rem', color: isDark ? '#94a3b8' : '#64748b' }}>Rango: {p10} - {p90}</Typography>
    </Box>
  );
}

export default function PredictorDemandaCard({ data }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const manana = data?.manana;
  const dias7 = data?.dias_7 || [];
  const proyeccion = data?.proyeccion_mes;
  const precision = data?.precision_historica_pct;

  const chartData = dias7.map(d => ({
    name: DIAS_SEMANA[new Date(d.fecha).getDay()],
    p10: d.p10,
    p50: d.p50,
    p90: d.p90,
  }));

  return (
    <Box sx={{ ...glassCardSx(theme, CYAN), padding: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{
          fontWeight: 700, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em',
          color: theme.palette.text.primary, fontFamily: GLASS_FONT_HEADING,
        }}>
          Demanda esperada
        </Typography>
        {precision != null && (
          <Box sx={{
            px: 1.25, py: 0.4, borderRadius: '8px',
            background: isDark ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.25)',
          }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669' }}>
              ±{precision}% de margen (últimos 30 días)
            </Typography>
          </Box>
        )}
      </Box>

      {!manana ? (
        <Typography sx={{ color: theme.palette.text.secondary, fontFamily: GLASS_FONT_BODY }}>
          No hay historial suficiente todavía para generar un pronóstico confiable.
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
            <Box sx={{ minWidth: 160 }}>
              <Typography sx={{ fontSize: '0.72rem', color: theme.palette.text.secondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Mañana
              </Typography>
              <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: theme.palette.text.primary, fontFamily: GLASS_FONT_HEADING, lineHeight: 1.1 }}>
                {manana.p10}-{manana.p90}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary }}>
                pedidos (~{manana.p50} más probable)
              </Typography>
            </Box>

            <Box sx={{ flex: 1, minWidth: 260, height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid stroke={isDark ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.045)'} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip isDark={isDark} />} />
                  <Bar dataKey="p50" fill={CYAN} radius={[4, 4, 0, 0]} barSize={22} />
                  <Line dataKey="p90" stroke={VIOLET} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                  <Line dataKey="p10" stroke={VIOLET} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Box>

          {proyeccion && (
            <Box sx={{ pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Typography sx={{ fontSize: '0.85rem', color: theme.palette.text.primary, fontFamily: GLASS_FONT_BODY }}>
                Proyección fin de mes: <strong>{formatoCLP(proyeccion.p10)} - {formatoCLP(proyeccion.p90)}</strong>
                {proyeccion.meta && <> (meta: {formatoCLP(proyeccion.meta)})</>}
              </Typography>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
