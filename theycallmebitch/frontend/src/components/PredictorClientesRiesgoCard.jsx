import React from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Chip } from '@mui/material';
import { glassCardSx, GLASS_FONT_HEADING, GLASS_FONT_BODY } from '../utils/glassCard';

const CYAN = '#06b6d4';

const ESTADO_INFO = {
  activo: { label: 'Activo', color: '#10b981' },
  en_riesgo: { label: 'En riesgo', color: '#f59e0b' },
  inactivo: { label: 'Inactivo', color: '#ef4444' },
};

const formatoCLP = (val) => `$${Math.round(val || 0).toLocaleString('es-CL')}`;

function ResumenChip({ label, value, color }) {
  return (
    <Box sx={{
      flex: '1 1 100px', textAlign: 'center', padding: '10px 8px',
      borderRadius: '12px', background: `${color}14`, border: `1px solid ${color}33`,
    }}>
      <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color, fontFamily: GLASS_FONT_HEADING }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: '0.7rem', color: color, fontWeight: 600 }}>{label}</Typography>
    </Box>
  );
}

export default function PredictorClientesRiesgoCard({ data }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const resumen = data?.resumen || { activos: 0, en_riesgo: 0, inactivos: 0 };
  const clientes = data?.clientes || [];

  // Prioridad visual: los primeros 20 por valor en juego (la lista ya
  // viene ordenada desde el backend).
  const clientesTop = clientes.slice(0, 20);

  return (
    <Box sx={{ ...glassCardSx(theme, CYAN), padding: 3 }}>
      <Typography sx={{
        fontWeight: 700, fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em',
        color: theme.palette.text.primary, fontFamily: GLASS_FONT_HEADING, mb: 2,
      }}>
        Clientes en riesgo
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <ResumenChip label="Activos" value={resumen.activos} color={ESTADO_INFO.activo.color} />
        <ResumenChip label="En riesgo" value={resumen.en_riesgo} color={ESTADO_INFO.en_riesgo.color} />
        <ResumenChip label="Inactivos" value={resumen.inactivos} color={ESTADO_INFO.inactivo.color} />
      </Box>

      {clientesTop.length === 0 ? (
        <Typography sx={{ color: theme.palette.text.secondary, fontFamily: GLASS_FONT_BODY }}>
          No hay datos de clientes todavía.
        </Typography>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <Box component="thead">
              <Box component="tr">
                {['Cliente', 'Última compra', 'Atraso', 'Gasto prom.', 'Estado'].map(h => (
                  <Box component="th" key={h} sx={{
                    textAlign: 'left', fontSize: '0.7rem', fontWeight: 700,
                    color: theme.palette.text.secondary, textTransform: 'uppercase',
                    letterSpacing: '0.04em', padding: '8px 10px',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  }}>
                    {h}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {clientesTop.map((c) => {
                const estado = ESTADO_INFO[c.estado] || ESTADO_INFO.activo;
                return (
                  <Box component="tr" key={c.usuario} sx={{
                    '&:hover': { background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                  }}>
                    <Box component="td" sx={{ padding: '8px 10px', fontSize: '0.82rem', color: theme.palette.text.primary, fontFamily: GLASS_FONT_BODY }}>
                      {c.usuario}
                    </Box>
                    <Box component="td" sx={{ padding: '8px 10px', fontSize: '0.82rem', color: theme.palette.text.secondary }}>
                      {c.ultima_compra}
                    </Box>
                    <Box component="td" sx={{ padding: '8px 10px', fontSize: '0.82rem', color: theme.palette.text.secondary }}>
                      {c.dias_atraso > 0 ? `+${c.dias_atraso}d` : 'al día'}
                    </Box>
                    <Box component="td" sx={{ padding: '8px 10px', fontSize: '0.82rem', color: theme.palette.text.primary, fontWeight: 600 }}>
                      {formatoCLP(c.gasto_promedio)}
                    </Box>
                    <Box component="td" sx={{ padding: '8px 10px' }}>
                      <Chip
                        label={estado.label}
                        size="small"
                        sx={{
                          background: `${estado.color}1a`, color: estado.color,
                          border: `1px solid ${estado.color}40`, fontWeight: 600, fontSize: '0.7rem',
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
