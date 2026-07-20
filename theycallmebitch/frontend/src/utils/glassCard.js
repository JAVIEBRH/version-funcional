// Estilo "glass" compartido por las KPI cards del dashboard.
// Centraliza el patrón ya usado por VentasCard/ChartCard/KpiMetaCard/FinancialKpiCard
// para que todas las tarjetas se vean parte de la misma familia visual.
export const glassCardSx = (theme, accent = '#06b6d4') => {
  const isDark = theme.palette.mode === 'dark';

  return {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '16px',
    background: isDark ? 'rgba(255,255,255,0.036)' : 'rgba(255,255,255,0.90)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: isDark ? '1px solid rgba(255,255,255,0.085)' : '1px solid rgba(0,0,0,0.07)',
    boxShadow: isDark
      ? '0 1px 3px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.35), 0 10px 36px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.055)'
      : '0 1px 3px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.07)',
    transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.32s ease, border-color 0.32s ease',
    '&:hover': {
      transform: 'translateY(-6px)',
      borderColor: isDark ? `${accent}48` : `${accent}38`,
      boxShadow: isDark
        ? `0 2px 4px rgba(0,0,0,0.5), 0 8px 28px rgba(0,0,0,0.42), 0 16px 56px ${accent}1a, 0 0 0 1px ${accent}28, inset 0 1px 0 rgba(255,255,255,0.07)`
        : `0 4px 12px rgba(0,0,0,0.08), 0 10px 36px ${accent}1f, 0 0 0 1px ${accent}22`,
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0, left: '20%', right: '20%',
      height: '1px',
      background: `linear-gradient(90deg, transparent, ${accent}44, transparent)`,
    },
  };
};

export const GLASS_FONT_HEADING = '"Plus Jakarta Sans", system-ui, sans-serif';
export const GLASS_FONT_BODY = '"DM Sans", system-ui, sans-serif';
