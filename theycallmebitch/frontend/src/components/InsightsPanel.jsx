import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import {
  Brain, AlertCircle, TrendingUp, TrendingDown, MapPin,
  Users, Cloud, RefreshCw, BookOpen, Zap, Activity,
  Cpu, Radio, Award, Target, Clock, BarChart2,
  DollarSign, ArrowUpRight, ArrowDownRight, Fuel
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://backenddashboard-vh7d.onrender.com';

/* ── Priority config ────────────────────────────────────────────── */
const PRIORITY = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.22)',  label: 'CRÍTICO' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)',  label: 'ALERTA'  },
  low:    { color: '#06b6d4', bg: 'rgba(6,182,212,0.06)',  border: 'rgba(6,182,212,0.16)',  label: 'INFO'    },
};

const TIPO_ICON = {
  alert:       <AlertCircle size={14} />,
  opportunity: <TrendingUp  size={14} />,
  zone:        <MapPin      size={14} />,
  churn:       <Users       size={14} />,
  weather:     <Cloud       size={14} />,
};

/* ── RFM segment colors ─────────────────────────────────────────── */
const RFM_SEG = {
  campeon:          { color: '#10b981', label: 'Campeones'   },
  leal:             { color: '#06b6d4', label: 'Leales'      },
  potencial_leal:   { color: '#8b5cf6', label: 'Potenciales' },
  nuevo:            { color: '#3b82f6', label: 'Nuevos'      },
  prometedor:       { color: '#a78bfa', label: 'Prometedores'},
  necesita_atencion:{ color: '#f59e0b', label: 'Necesitan atención' },
  en_riesgo:        { color: '#f97316', label: 'En riesgo'   },
  perdido:          { color: '#ef4444', label: 'Perdidos'    },
};

/* ── Weather emoji ──────────────────────────────────────────────── */
const weatherEmoji = (desc = '') => {
  const d = desc.toLowerCase();
  if (d.includes('sol') || d.includes('clear') || d.includes('despej')) return '☀️';
  if (d.includes('parcial') || d.includes('partly'))                     return '⛅';
  if (d.includes('nub') || d.includes('cloud') || d.includes('cubierto')) return '☁️';
  if (d.includes('llovizn') || d.includes('drizzle'))                    return '🌦️';
  if (d.includes('lluvi') || d.includes('rain'))                         return '🌧️';
  if (d.includes('tormenta') || d.includes('thunder'))                   return '⛈️';
  if (d.includes('nieve') || d.includes('snow'))                         return '❄️';
  if (d.includes('niebla') || d.includes('fog'))                         return '🌫️';
  if (d.includes('simulad'))                                             return '🔧';
  return '🌤️';
};

const dayName = (fechaStr) => {
  const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const d = new Date(fechaStr + 'T12:00:00');
  return days[d.getDay()];
};

/* ── Shared glass section ───────────────────────────────────────── */
const Section = ({ children, accentColor = '#06b6d4', delay = 0 }) => (
  <Box sx={{
    position: 'relative',
    background: 'rgba(255,255,255,0.028)',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.07)',
    borderLeft: `2px solid ${accentColor}`,
    p: 2.5, mb: 2,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
    animation: 'secIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
    animationDelay: `${delay}s`,
    '@keyframes secIn': {
      from: { opacity: 0, transform: 'translateY(12px)' },
      to:   { opacity: 1, transform: 'translateY(0)' },
    },
    '&::before': {
      content: '""', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      background: `radial-gradient(ellipse 60% 40% at 0% 0%, ${accentColor}0a, transparent)`,
      borderRadius: 'inherit', pointerEvents: 'none',
    },
  }}>
    {children}
  </Box>
);

const SectionTitle = ({ icon, label, color = '#06b6d4', right }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.75 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
        {label}
      </Typography>
    </Box>
    {right}
  </Box>
);

const Badge = ({ label, color }) => (
  <Box sx={{ px: 0.85, py: 0.2, borderRadius: '5px', background: `${color}18`, border: `1px solid ${color}35`, flexShrink: 0 }}>
    <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color, letterSpacing: '0.06em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{label}</Typography>
  </Box>
);

/* ════════════════════════════════════════════════════════════════
   BRIEFING
════════════════════════════════════════════════════════════════ */
const BriefingSection = ({ refreshKey }) => {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/briefing`)
      .then(r => r.json()).then(d => setBriefing(d.briefing))
      .catch(() => setBriefing(null)).finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return (
    <Section accentColor="#3b82f6" delay={0.05}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CircularProgress size={14} sx={{ color: '#3b82f6' }} />
        <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontFamily: '"DM Sans", system-ui, sans-serif' }}>Generando briefing ejecutivo...</Typography>
      </Box>
    </Section>
  );
  if (!briefing) return null;

  return (
    <Section accentColor="#3b82f6" delay={0.05}>
      <SectionTitle icon={<BookOpen size={14} />} label="Briefing Ejecutivo del Día" color="#3b82f6" />
      <Typography sx={{ fontSize: '0.79rem', lineHeight: 1.8, color: '#94a3b8', whiteSpace: 'pre-wrap', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
        {briefing}
      </Typography>
    </Section>
  );
};

/* ════════════════════════════════════════════════════════════════
   CLIMA + BENCINA — WIDGET DIVIDIDO
════════════════════════════════════════════════════════════════ */
const ClimaSection = ({ refreshKey }) => {
  const [clima,   setClima]   = useState(null);
  const [bencina, setBencina] = useState({ precio_litro: 1497, precio_litro_anterior: 1497, variacion_pct: 0, fuente: 'último_conocido' });

  useEffect(() => {
    fetch(`${API}/clima`).then(r => r.json()).then(setClima).catch(() => {});
    fetch(`${API}/bencina`).then(r => r.json()).then(data => { if (data?.precio_litro) setBencina(data); }).catch(() => {});
  }, [refreshKey]);

  if (!clima) return null;

  const positive   = clima.impacto_demanda_pct >= 0;
  const impColor   = positive ? '#10b981' : '#ef4444';
  const esSimulado = clima.fuente === 'simulado';
  const emoji      = weatherEmoji(clima.descripcion);
  const multColor  = clima.multiplicador_demanda_hoy >= 1 ? '#10b981' : '#f59e0b';

  // Bencina vars
  const bPrecio   = bencina?.precio_litro || 0;
  const bVariacion = bencina?.variacion_pct || 0;
  const bSubio    = bVariacion > 0;
  const bIgual    = bVariacion === 0;
  const bVarColor = bIgual ? '#94a3b8' : bSubio ? '#ef4444' : '#10b981';
  const tanque60  = bPrecio * 60;
  const tanque40  = bPrecio * 40;
  const bFuenteLabel = bencina?.fuente === 'CNE' ? 'CNE' : bencina?.fuente === 'ENAP' ? 'ENAP' : 'REF';
  const bFuenteColor = bencina?.fuente === 'último_conocido' ? '#f59e0b' : '#10b981';

  return (
    <Section accentColor="#38bdf8" delay={0.1}>
      {/* ── Header dual ───────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.75 }}>
        {/* Izquierda: clima */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ color: '#38bdf8', display: 'flex' }}><Cloud size={14} /></Box>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#38bdf8', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
            Clima Puente Alto · Impacto Demanda
          </Typography>
          <Badge label={esSimulado ? 'SIMULADO' : 'REAL · Open-Meteo'} color={esSimulado ? '#f59e0b' : '#10b981'} />
        </Box>
        {/* Derecha: bencina label */}
        {bencina && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ color: '#fbbf24', display: 'flex' }}><Fuel size={14} /></Box>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#fbbf24', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
              Bencina 93 · Copec
            </Typography>
            <Badge label={bFuenteLabel} color={bFuenteColor} />
          </Box>
        )}
      </Box>

      {/* ── Cuerpo dividido ───────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>

        {/* ── LADO IZQUIERDO: CLIMA ──────────────────────────────── */}
        <Box sx={{ flex: '1 1 50%', minWidth: 0, pr: 2.5 }}>
          {/* Stats row */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>{emoji}</Typography>
              <Box>
                <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1, color: '#e2e8f0', letterSpacing: '-0.04em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                  {clima.temp_actual}°C
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', mt: 0.3, fontFamily: '"DM Sans", system-ui, sans-serif', textTransform: 'capitalize' }}>
                  {clima.descripcion}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ width: '1px', height: 44, bgcolor: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, color: '#38bdf8', letterSpacing: '-0.03em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                {clima.humedad}%
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, mt: 0.35, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                Humedad
              </Typography>
            </Box>

            <Box sx={{ width: '1px', height: 44, bgcolor: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, color: impColor, letterSpacing: '-0.03em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                {positive ? '+' : ''}{clima.impacto_demanda_pct}%
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, mt: 0.35, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                Impacto demanda
              </Typography>
            </Box>

            <Box sx={{ width: '1px', height: 44, bgcolor: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

            <Box sx={{ textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, color: multColor, letterSpacing: '-0.03em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                {clima.multiplicador_demanda_hoy}x
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, mt: 0.35, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                Multiplicador
              </Typography>
            </Box>

            {clima.lluvia_hoy_mm > 0 && (
              <>
                <Box sx={{ width: '1px', height: 44, bgcolor: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, color: '#67e8f9', letterSpacing: '-0.03em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                    {clima.lluvia_hoy_mm}mm
                  </Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, mt: 0.35, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                    Lluvia hoy
                  </Typography>
                </Box>
              </>
            )}
          </Box>

          {/* Forecast 5 días */}
          {clima.forecast_5_dias?.length > 0 && (
            <>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                Pronóstico 5 días
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: '3px' }, '&::-webkit-scrollbar-thumb': { background: 'rgba(56,189,248,0.2)', borderRadius: '99px' } }}>
                {clima.forecast_5_dias.map((dia, i) => {
                  const mColor = dia.multiplicador_demanda >= 1 ? '#10b981' : '#f59e0b';
                  return (
                    <Box key={i} sx={{ flexShrink: 0, minWidth: 72, p: 1.25, borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                        {dayName(dia.fecha)}
                      </Typography>
                      <Typography sx={{ fontSize: '1.3rem', my: 0.5 }}>{weatherEmoji(dia.descripcion)}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#e2e8f0', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                        {Math.round(dia.temp_max)}° / {Math.round(dia.temp_min)}°
                      </Typography>
                      <Box sx={{ mt: 0.75, px: 0.5, py: 0.2, borderRadius: '5px', background: `${mColor}18`, border: `1px solid ${mColor}30` }}>
                        <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: mColor, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                          {dia.multiplicador_demanda}x
                        </Typography>
                      </Box>
                      {dia.lluvia_mm > 0 && (
                        <Typography sx={{ fontSize: '0.6rem', color: '#67e8f9', mt: 0.35, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                          {dia.lluvia_mm}mm
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </>
          )}

          {esSimulado && (
            <Typography sx={{ mt: 1.5, fontSize: '0.68rem', color: 'rgba(156,163,175,0.4)', fontStyle: 'italic', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
              Temperatura estimada
            </Typography>
          )}
        </Box>

        {/* ── DIVISOR CENTRAL ───────────────────────────────────────── */}
        {bencina && (
          <Box sx={{
            width: '1px', flexShrink: 0, mx: 0,
            background: 'linear-gradient(180deg, transparent 0%, rgba(245,158,11,0.18) 15%, rgba(245,158,11,0.22) 50%, rgba(56,189,248,0.18) 85%, transparent 100%)',
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '5px', height: '5px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              boxShadow: '0 0 6px rgba(245,158,11,0.4), 0 0 12px rgba(56,189,248,0.2)',
            },
          }} />
        )}

        {/* ── LADO DERECHO: BENCINA ─────────────────────────────────── */}
        {bencina && (
          <Box sx={{ flex: '1 1 50%', minWidth: 0, pl: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {/* Precio grande */}
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.32)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.4, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                Precio por litro
              </Typography>
              <Typography sx={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1, color: '#fbbf24', letterSpacing: '-0.04em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums', textShadow: '0 0 20px rgba(251,191,36,0.25)' }}>
                ${bPrecio.toLocaleString('es-CL')}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.28)', mt: 0.35, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                CLP / litro · 93 octanos
              </Typography>
            </Box>

            {/* Variación vs semana */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2, px: 1, py: 0.6, borderRadius: '8px', background: `${bVarColor}0d`, border: `1px solid ${bVarColor}22`, width: 'fit-content' }}>
              {!bIgual && (bSubio
                ? <ArrowUpRight size={12} color={bVarColor} />
                : <ArrowDownRight size={12} color={bVarColor} />
              )}
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: bVarColor, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                {bIgual ? 'Sin variación' : `${bSubio ? '+' : ''}${bVariacion}% vs sem. ant.`}
              </Typography>
            </Box>

            {/* Costos de carga */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {[
                { l: 'Tanque 60L (reparto)', v: tanque60 },
                { l: 'Carga 40L',            v: tanque40 },
              ].map((item, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.25, py: 0.75, borderRadius: '8px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)' }}>
                  <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.38)', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                    {item.l}
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                    ${item.v.toLocaleString('es-CL')}
                  </Typography>
                </Box>
              ))}
            </Box>

            {bSubio && (
              <Typography sx={{ mt: 1.25, fontSize: '0.63rem', color: 'rgba(239,68,68,0.7)', fontFamily: '"DM Sans", system-ui, sans-serif', lineHeight: 1.5 }}>
                ↑ Bencina subió — revisar margen por zona
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Section>
  );
};

/* ════════════════════════════════════════════════════════════════
   RFM — SEGMENTOS COMPLETOS + CAMPEONES
════════════════════════════════════════════════════════════════ */
const RFMSection = ({ refreshKey }) => {
  const [rfm, setRfm] = useState(null);

  useEffect(() => {
    fetch(`${API}/rfm`).then(r => r.json()).then(setRfm).catch(() => {});
  }, [refreshKey]);

  if (!rfm?.total_clientes) return null;

  const total = rfm.resumen_segmentos?.reduce((s, x) => s + x.cantidad, 0) || 1;

  return (
    <Section accentColor="#8b5cf6" delay={0.15}>
      <SectionTitle icon={<Users size={14} />} label="Segmentación RFM de Clientes" color="#8b5cf6" />

      {/* KPI grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 2.5 }}>
        {[
          { v: rfm.total_clientes,          l: 'Total',      c: '#e2e8f0' },
          { v: rfm.clientes_en_riesgo_count, l: 'En riesgo', c: '#ef4444' },
          { v: rfm.resumen_segmentos?.find(s => s.segmento === 'campeon')?.cantidad || 0, l: 'Campeones', c: '#10b981' },
          { v: `$${((rfm.revenue_en_riesgo||0)/1000).toFixed(0)}K`, l: 'Rev. riesgo', c: '#f59e0b' },
        ].map((s, i) => (
          <Box key={i} sx={{ p: 1.5, background: 'rgba(255,255,255,0.035)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: s.c, lineHeight: 1, letterSpacing: '-0.03em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>{s.v}</Typography>
            <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, mt: 0.5, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: '"DM Sans", system-ui, sans-serif' }}>{s.l}</Typography>
          </Box>
        ))}
      </Box>

      {/* All segments stacked bar */}
      {rfm.resumen_segmentos?.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
            Distribución de segmentos
          </Typography>
          {/* Stacked bar */}
          <Box sx={{ height: 8, borderRadius: '99px', overflow: 'hidden', display: 'flex', mb: 1.5 }}>
            {rfm.resumen_segmentos.map((seg, i) => {
              const cfg = RFM_SEG[seg.segmento] || { color: '#64748b' };
              const pct = (seg.cantidad / total) * 100;
              return <Box key={i} sx={{ height: '100%', width: `${pct}%`, bgcolor: cfg.color, transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)' }} />;
            })}
          </Box>
          {/* Legend */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {rfm.resumen_segmentos.map((seg, i) => {
              const cfg = RFM_SEG[seg.segmento] || { color: '#64748b', label: seg.segmento };
              return (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: cfg.color, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.5)', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                    {cfg.label} <span style={{ color: cfg.color, fontWeight: 700 }}>{seg.cantidad}</span>
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Top champions */}
      {rfm.clientes_campeon?.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            <Award size={12} color="#10b981" />
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
              Top clientes campeones
            </Typography>
          </Box>
          {rfm.clientes_campeon.slice(0, 4).map((c, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 0.9, mb: 0.5, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)', borderRadius: '9px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 20, height: 20, borderRadius: '6px', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#10b981' }}>{i + 1}</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{c.usuario}</Typography>
                  <Typography sx={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.35)', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                    {c.frecuencia} compras · {c.recencia_dias}d reciente
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                ${(c.monetario||0).toLocaleString('es-CL')}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* At-risk clients */}
      {rfm.clientes_en_riesgo?.length > 0 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            <AlertCircle size={12} color="#ef4444" />
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
              Top clientes en riesgo de fuga
            </Typography>
          </Box>
          {rfm.clientes_en_riesgo.slice(0, 5).map((c, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 0.9, mb: 0.5, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: '9px' }}>
              <Box>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{c.usuario}</Typography>
                <Typography sx={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.35)', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                  {c.dias_sobre_cadencia > 0 ? `${c.dias_sobre_cadencia}d sobre cadencia` : `${c.recencia_dias}d sin comprar`}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: '#ef4444', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{c.churn_prob}%</Typography>
                <Typography sx={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.35)', fontFamily: '"DM Sans", system-ui, sans-serif' }}>${(c.monetario||0).toLocaleString('es-CL')}</Typography>
              </Box>
            </Box>
          ))}
        </>
      )}
    </Section>
  );
};

/* ════════════════════════════════════════════════════════════════
   ZONAS — PERFORMANCE + ALERTAS DE CAÍDA
════════════════════════════════════════════════════════════════ */
const ZonasSection = ({ refreshKey }) => {
  const [zonas, setZonas] = useState(null);

  useEffect(() => {
    fetch(`${API}/zonas`).then(r => r.json()).then(setZonas).catch(() => {});
  }, [refreshKey]);

  if (!zonas?.zonas?.length) return null;

  const ESTADO_COLOR = { creciendo: '#10b981', estable: '#06b6d4', cayendo: '#ef4444', inactiva: '#f59e0b', dormida: '#475569' };
  const sorted = [...zonas.zonas].sort((a, b) => b.revenue_30d - a.revenue_30d);
  const maxRev = Math.max(...sorted.map(z => z.revenue_30d || 0), 1);

  return (
    <Section accentColor="#8b5cf6" delay={0.2}>
      <SectionTitle
        icon={<MapPin size={14} />}
        label="Desempeño por Zona Geográfica"
        color="#8b5cf6"
        right={<Badge label={`LÍDER: ${zonas.zona_lider}`} color="#8b5cf6" />}
      />

      {/* Summary pills */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Box sx={{ px: 1.25, py: 0.6, borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
            {zonas.total_zonas_activas} activas
          </Typography>
        </Box>
        <Box sx={{ px: 1.25, py: 0.6, borderRadius: '8px', background: 'rgba(71,85,105,0.15)', border: '1px solid rgba(71,85,105,0.25)' }}>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
            {zonas.total_zonas_dormidas} dormidas
          </Typography>
        </Box>
      </Box>

      {/* Zone bars */}
      {sorted.map((z, i) => {
        const c = ESTADO_COLOR[z.estado] || '#64748b';
        const pct = Math.round((z.revenue_30d / maxRev) * 100);
        return (
          <Box key={i} sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c, boxShadow: `0 0 5px ${c}80`, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, color: '#e2e8f0', textTransform: 'capitalize', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{z.zona}</Typography>
                <Typography sx={{ fontSize: '0.66rem', color: c, fontWeight: 600, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                  {z.estado} {z.tendencia_pct > 0 ? `+${z.tendencia_pct}%` : `${z.tendencia_pct}%`}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.3)', fontFamily: '"DM Sans", system-ui, sans-serif' }}>{z.clientes_unicos} clientes</Typography>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                  {z.pedidos_30d} pedidos
                </Typography>
              </Box>
            </Box>
            <Box sx={{ height: 4, borderRadius: '99px', bgcolor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', borderRadius: '99px', background: `linear-gradient(90deg, ${c}, ${c}88)`, width: `${pct}%`, transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: `0 0 8px ${c}50` }} />
            </Box>
          </Box>
        );
      })}

      {/* Alertas de caída */}
      {zonas.alertas_caida?.length > 0 && (
        <Box sx={{ mt: 2, p: 1.75, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
            <TrendingDown size={12} color="#ef4444" />
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
              Zonas en caída
            </Typography>
          </Box>
          {zonas.alertas_caida.map((a, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.6, borderBottom: i < zonas.alertas_caida.length - 1 ? '1px solid rgba(239,68,68,0.08)' : 'none' }}>
              <Typography sx={{ fontSize: '0.76rem', fontWeight: 600, color: '#fca5a5', textTransform: 'capitalize', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{a.zona}</Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{a.caida_pct}% caída</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', fontFamily: '"DM Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>-${(a.revenue_perdido||0).toLocaleString('es-CL')}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Oportunidades de reactivación */}
      {zonas.oportunidades_reactivacion?.length > 0 && (
        <Box sx={{ mt: 1.5, p: 1.75, background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.16)', borderRadius: '10px' }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
            Oportunidades de Reactivación
          </Typography>
          {zonas.oportunidades_reactivacion.slice(0, 3).map((op, i) => (
            <Typography key={i} sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.48)', mb: 0.5, lineHeight: 1.55, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
              · {op.accion}
            </Typography>
          ))}
        </Box>
      )}
    </Section>
  );
};

/* ════════════════════════════════════════════════════════════════
   PUNTO DE EQUILIBRIO — nuevo
════════════════════════════════════════════════════════════════ */
const EquilibrioSection = ({ refreshKey }) => {
  const [kpis, setKpis] = useState(null);

  useEffect(() => {
    fetch(`${API}/kpis`).then(r => r.json()).then(setKpis).catch(() => {});
  }, [refreshKey]);

  if (!kpis?.punto_equilibrio) return null;

  const bidonesVendidos = Math.round((kpis.litros_vendidos || 0) / 20);
  const puntoEq        = kpis.punto_equilibrio;
  const pct            = Math.min(100, Math.round((bidonesVendidos / puntoEq) * 100));
  const superado       = bidonesVendidos >= puntoEq;
  const barColor       = pct >= 100 ? '#10b981' : pct >= 75 ? '#06b6d4' : pct >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <Section accentColor={barColor} delay={0.25}>
      <SectionTitle
        icon={<Target size={14} />}
        label="Punto de Equilibrio Operacional"
        color={barColor}
        right={<Badge label={superado ? '✓ CUBIERTO' : 'EN CURSO'} color={barColor} />}
      />

      <Box sx={{ display: 'flex', gap: 3, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: barColor, letterSpacing: '-0.04em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
            {bidonesVendidos}
          </Typography>
          <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, mt: 0.4, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
            Bidones vendidos
          </Typography>
        </Box>
        <Box sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '1.2rem' }}>/</Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: '#64748b', letterSpacing: '-0.04em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
            {puntoEq}
          </Typography>
          <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, mt: 0.4, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
            Punto equilibrio
          </Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 140 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
            <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontFamily: '"DM Sans", system-ui, sans-serif' }}>Cobertura de cuota</Typography>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: barColor, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{pct}%</Typography>
          </Box>
          <Box sx={{ height: 8, borderRadius: '99px', bgcolor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', borderRadius: '99px', background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`, width: `${pct}%`, transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: `0 0 10px ${barColor}60` }} />
          </Box>
          <Typography sx={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.3)', mt: 0.6, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
            {superado
              ? `✓ Cuota cubierta — ${bidonesVendidos - puntoEq} bidones de margen`
              : `Faltan ${puntoEq - bidonesVendidos} bidones para cubrir cuota fija`}
          </Typography>
        </Box>
      </Box>

      {/* Costos breakdown */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {[
          { l: 'Costos reales', v: `$${(kpis.costos_reales||0).toLocaleString('es-CL')}`, c: '#ef4444' },
          { l: 'IVA débito',    v: `$${(kpis.iva||0).toLocaleString('es-CL')}`,           c: '#f59e0b' },
          { l: 'Utilidad neta', v: `$${(kpis.utilidad||0).toLocaleString('es-CL')}`,       c: kpis.utilidad >= 0 ? '#10b981' : '#ef4444' },
        ].map((s, i) => (
          <Box key={i} sx={{ flex: '1 1 100px', px: 1.5, py: 1.25, background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: `1px solid ${s.c}18` }}>
            <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.4, fontFamily: '"DM Sans", system-ui, sans-serif' }}>{s.l}</Typography>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: s.c, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{s.v}</Typography>
          </Box>
        ))}
      </Box>
    </Section>
  );
};

/* ════════════════════════════════════════════════════════════════
   HISTORIAL DE ALERTAS — nuevo
════════════════════════════════════════════════════════════════ */
const HistorialSection = ({ refreshKey }) => {
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    fetch(`${API}/memoria/historial`)
      .then(r => r.json())
      .then(d => setHistorial(d.historial || []))
      .catch(() => {});
  }, [refreshKey]);

  if (!historial.length) return null;

  return (
    <Section accentColor="#475569" delay={0.3}>
      <SectionTitle icon={<Clock size={14} />} label="Historial de Alertas Recientes" color="#64748b" />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {historial.slice(0, 8).map((h, i) => {
          const p  = PRIORITY[h.prioridad] || PRIORITY.low;
          const ts = new Date(h.timestamp);
          const timeStr = `${ts.getDate().toString().padStart(2,'0')}/${(ts.getMonth()+1).toString().padStart(2,'0')} ${ts.getHours().toString().padStart(2,'0')}:${ts.getMinutes().toString().padStart(2,'0')}`;
          return (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 0.85, borderBottom: i < historial.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              {/* Priority dot */}
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: p.color, mt: '5px', flexShrink: 0, boxShadow: `0 0 4px ${p.color}80` }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.5, fontFamily: '"DM Sans", system-ui, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.mensaje}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', flexShrink: 0, fontFamily: '"DM Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums', mt: '2px' }}>
                {timeStr}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Section>
  );
};

/* ════════════════════════════════════════════════════════════════
   INSIGHTS AUTÓNOMOS
════════════════════════════════════════════════════════════════ */
const InsightsAutonomos = ({ insights, loading }) => (
  <>
    {/* Divider */}
    <Box sx={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.25), transparent)', my: 2.5 }} />

    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Box sx={{ width: 28, height: 28, borderRadius: '8px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Zap size={14} color="#f59e0b" />
      </Box>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
        Alertas y Oportunidades Autónomas
      </Typography>
      {insights.length > 0 && (
        <Box sx={{ px: 0.75, py: 0.1, borderRadius: '5px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.28)' }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#f59e0b', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{insights.length}</Typography>
        </Box>
      )}
    </Box>

    {loading && insights.length === 0 ? (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2.5 }}>
        <CircularProgress size={16} sx={{ color: '#06b6d4' }} />
        <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.3)', fontFamily: '"DM Sans", system-ui, sans-serif' }}>El motor estratégico está analizando...</Typography>
      </Box>
    ) : insights.length === 0 ? (
      <Box sx={{ p: 2.5, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.07)' }}>
        <Activity size={20} color="rgba(255,255,255,0.2)" style={{ margin: '0 auto 8px', display: 'block' }} />
        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', fontFamily: '"DM Sans", system-ui, sans-serif' }}>Los insights aparecerán aquí en breve.</Typography>
      </Box>
    ) : (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {insights.map((ins, idx) => {
          const p = PRIORITY[ins.priority] || PRIORITY.low;
          return (
            <Box key={idx} sx={{
              position: 'relative', p: 2.25, borderRadius: '14px',
              background: p.bg, border: `1px solid ${p.border}`,
              borderLeft: `3px solid ${p.color}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
              animation: 'insIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
              animationDelay: `${idx * 0.07}s`,
              '@keyframes insIn': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
              '&::before': { content: '""', position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 50% at 0% 0%, ${p.color}08, transparent)`, borderRadius: 'inherit', pointerEvents: 'none' },
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: p.color }}>{TIPO_ICON[ins.type] || <AlertCircle size={14} />}</Box>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{ins.type}</Typography>
                </Box>
                <Badge label={p.label} color={p.color} />
              </Box>
              <Typography sx={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', mb: 0.75, lineHeight: 1.5, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{ins.message}</Typography>
              {ins.impact && (
                <Typography sx={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 600, mb: 1, fontFamily: '"DM Sans", system-ui, sans-serif' }}>↑ {ins.impact}</Typography>
              )}
              <Box sx={{ p: 1.5, background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.4, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>Acción</Typography>
                    <Typography sx={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.55, fontFamily: '"DM Sans", system-ui, sans-serif' }}>{ins.action}</Typography>
                  </Box>
                  <Box
                    onClick={() => window.dispatchEvent(new CustomEvent('ceo-chat-action', { detail: { query: `${ins.message}\n\nAcción requerida: ${ins.action}` } }))}
                    sx={{
                      flexShrink: 0, mt: 0.25, px: 1.25, py: 0.5, borderRadius: '7px', cursor: 'pointer',
                      background: `${p.color}15`, border: `1px solid ${p.color}35`,
                      display: 'flex', alignItems: 'center', gap: 0.6,
                      transition: 'all 0.18s ease',
                      '&:hover': { background: `${p.color}28`, borderColor: `${p.color}60`, transform: 'scale(1.03)' },
                    }}
                  >
                    <Zap size={10} color={p.color} />
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: p.color, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                      Ejecutar
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
    )}
  </>
);

/* ════════════════════════════════════════════════════════════════
   BENCINA 93 — PRECIO COPEC
════════════════════════════════════════════════════════════════ */
const BencinaSection = ({ refreshKey }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${API}/bencina`).then(r => r.json()).then(setData).catch(() => {});
  }, [refreshKey]);

  if (!data) return null;

  const precio    = data.precio_litro || 0;
  const anterior  = data.precio_litro_anterior || precio;
  const variacion = data.variacion_pct || 0;
  const subio     = variacion > 0;
  const igual     = variacion === 0;
  const varColor  = igual ? '#94a3b8' : subio ? '#ef4444' : '#10b981';
  const tanque60L = precio * 60;
  const tanque40L = precio * 40;
  const fuenteLabel = data.fuente === 'CNE'            ? 'REAL · CNE Chile'
                    : data.fuente === 'ENAP'           ? 'REAL · ENAP'
                    : data.fuente === 'último_conocido' ? 'ÚLTIMO CONOCIDO'
                    : 'REFERENCIA';
  const fuenteColor = data.fuente === 'último_conocido' ? '#f59e0b' : '#10b981';

  return (
    <Section accentColor="#f59e0b" delay={0.05}>
      <SectionTitle
        icon={<Fuel size={14} />}
        label="Bencina 93 · Copec · Precio Actual"
        color="#f59e0b"
        right={<Badge label={fuenteLabel} color={fuenteColor} />}
      />

      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-end', flexWrap: 'wrap', mb: 2 }}>
        {/* Precio por litro */}
        <Box>
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.3, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
            Precio / litro
          </Typography>
          <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1, color: '#fbbf24', letterSpacing: '-0.04em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
            ${precio.toLocaleString('es-CL')}
          </Typography>
          <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', mt: 0.3, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
            CLP / litro · 93 octanos
          </Typography>
        </Box>

        <Box sx={{ width: '1px', height: 44, bgcolor: 'rgba(255,255,255,0.07)', flexShrink: 0, mb: 0.5 }} />

        {/* Variación */}
        <Box>
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.3, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
            Vs semana ant.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {!igual && (subio
              ? <ArrowUpRight size={16} color={varColor} />
              : <ArrowDownRight size={16} color={varColor} />
            )}
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, color: varColor, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
              {igual ? '—' : `${subio ? '+' : ''}${variacion}%`}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ width: '1px', height: 44, bgcolor: 'rgba(255,255,255,0.07)', flexShrink: 0, mb: 0.5 }} />

        {/* Costo llenar tanque */}
        <Box>
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.3, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
            Llenar tanque
          </Typography>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, lineHeight: 1, color: '#e2e8f0', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
            ${tanque60L.toLocaleString('es-CL')}
          </Typography>
          <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', mt: 0.3, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
            60 litros (reparto)
          </Typography>
        </Box>
      </Box>

      {/* Nota costo por carga parcial */}
      <Box sx={{ p: 1.5, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.14)', borderRadius: '10px' }}>
        <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
          Carga parcial 40L:{' '}
          <strong style={{ color: '#fbbf24' }}>${tanque40L.toLocaleString('es-CL')}</strong>
          {subio && (
            <span style={{ color: '#ef4444' }}>{' · Bencina subió — revisar margen por zona'}</span>
          )}
        </Typography>
      </Box>
    </Section>
  );
};

/* ════════════════════════════════════════════════════════════════
   FLUJO DE CAJA DEL DÍA
════════════════════════════════════════════════════════════════ */
const FlujoCajaSection = ({ refreshKey }) => {
  const [data, setData]       = useState(null);
  const [kpis, setKpis]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/ventas-diarias`).then(r => r.json()).catch(() => null),
      fetch(`${API}/kpis`).then(r => r.json()).catch(() => null),
    ]).then(([vd, kp]) => {
      setData(vd);
      setKpis(kp);
    }).finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return (
    <Section accentColor="#10b981" delay={0}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CircularProgress size={14} sx={{ color: '#10b981' }} />
        <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
          Calculando flujo de caja...
        </Typography>
      </Box>
    </Section>
  );
  if (!data) return null;

  const ventasHoy      = data.ventas_hoy || 0;
  const ventasAyer     = data.ventas_mismo_dia_mes_anterior || 0;
  const pctCambio      = data.porcentaje_cambio || 0;
  const esPositivo     = data.es_positivo !== false;
  const tendencia      = data.tendencia_7_dias || [];
  const utilidad       = kpis?.utilidad ?? null;
  const costos         = kpis?.costos_reales ?? null;

  // Meta diaria estimada: promedio de la tendencia de 7 días (excluyendo hoy)
  const diasPasados    = tendencia.slice(0, 6);
  const promedioSemana = diasPasados.length
    ? Math.round(diasPasados.reduce((s, d) => s + d.ventas, 0) / diasPasados.length)
    : 0;
  const metaDiaria     = promedioSemana || 1;
  const pctMeta        = Math.min(100, Math.round((ventasHoy / metaDiaria) * 100));
  const metaColor      = pctMeta >= 100 ? '#10b981' : pctMeta >= 70 ? '#06b6d4' : pctMeta >= 40 ? '#f59e0b' : '#ef4444';

  // Sparkline: max para escalar barras
  const maxVenta = Math.max(...tendencia.map(d => d.ventas), 1);

  return (
    <Section accentColor="#10b981" delay={0}>
      <SectionTitle
        icon={<DollarSign size={14} />}
        label="Flujo de Caja · Hoy"
        color="#10b981"
        right={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.85, py: 0.2, borderRadius: '5px', background: esPositivo ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', border: `1px solid ${esPositivo ? 'rgba(16,185,129,0.28)' : 'rgba(239,68,68,0.25)'}` }}>
            {esPositivo
              ? <ArrowUpRight size={11} color="#10b981" />
              : <ArrowDownRight size={11} color="#ef4444" />}
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: esPositivo ? '#10b981' : '#ef4444', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
              {esPositivo ? '+' : ''}{pctCambio}% vs mes ant.
            </Typography>
          </Box>
        }
      />

      {/* Ventas hoy + vs ayer */}
      <Box sx={{ display: 'flex', gap: 3, mb: 2.5, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.4, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
            Ingresos hoy
          </Typography>
          <Typography sx={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1, color: '#e2e8f0', letterSpacing: '-0.04em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
            ${ventasHoy.toLocaleString('es-CL')}
          </Typography>
        </Box>

        {ventasAyer > 0 && (
          <>
            <Box sx={{ width: '1px', height: 36, bgcolor: 'rgba(255,255,255,0.07)', flexShrink: 0, mb: 0.5 }} />
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.4, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                Mismo día mes ant.
              </Typography>
              <Typography sx={{ fontSize: '1.35rem', fontWeight: 700, lineHeight: 1, color: 'rgba(255,255,255,0.4)', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                ${ventasAyer.toLocaleString('es-CL')}
              </Typography>
            </Box>
          </>
        )}

        {utilidad !== null && (
          <>
            <Box sx={{ width: '1px', height: 36, bgcolor: 'rgba(255,255,255,0.07)', flexShrink: 0, mb: 0.5 }} />
            <Box>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.4, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                Utilidad mes
              </Typography>
              <Typography sx={{ fontSize: '1.35rem', fontWeight: 700, lineHeight: 1, color: utilidad >= 0 ? '#10b981' : '#ef4444', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                ${(utilidad || 0).toLocaleString('es-CL')}
              </Typography>
            </Box>
          </>
        )}
      </Box>

      {/* Barra de progreso meta diaria */}
      {promedioSemana > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.7 }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.38)', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
              Progreso vs promedio semanal
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: metaColor, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
              {pctMeta}%
            </Typography>
          </Box>
          <Box sx={{ height: 7, borderRadius: '99px', bgcolor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <Box sx={{
              height: '100%', borderRadius: '99px',
              background: `linear-gradient(90deg, ${metaColor}, ${metaColor}cc)`,
              width: `${pctMeta}%`,
              transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow: `0 0 10px ${metaColor}55`,
            }} />
          </Box>
          <Typography sx={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.28)', mt: 0.6, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
            {pctMeta >= 100
              ? `Meta superada — $${(ventasHoy - promedioSemana).toLocaleString('es-CL')} sobre el promedio`
              : `Faltan $${(promedioSemana - ventasHoy).toLocaleString('es-CL')} para igualar el promedio diario`}
          </Typography>
        </Box>
      )}

      {/* Sparkline 7 días */}
      {tendencia.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
            Últimos 7 días
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-end', height: 44 }}>
            {tendencia.map((d, i) => {
              const isHoy    = i === tendencia.length - 1;
              const barH     = Math.max(4, Math.round((d.ventas / maxVenta) * 44));
              const barColor = isHoy ? '#10b981' : 'rgba(255,255,255,0.12)';
              return (
                <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{
                    width: '100%', height: `${barH}px`, borderRadius: '4px 4px 2px 2px',
                    background: isHoy
                      ? 'linear-gradient(180deg, #10b981, #059669)'
                      : 'rgba(255,255,255,0.1)',
                    boxShadow: isHoy ? '0 0 8px rgba(16,185,129,0.4)' : 'none',
                    transition: 'height 0.8s cubic-bezier(0.34,1.56,0.64,1)',
                  }} />
                  <Typography sx={{ fontSize: '0.55rem', color: isHoy ? '#10b981' : 'rgba(255,255,255,0.25)', fontWeight: isHoy ? 800 : 500, fontFamily: '"DM Sans", system-ui, sans-serif', textAlign: 'center' }}>
                    {d.dia_semana}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Section>
  );
};

/* ════════════════════════════════════════════════════════════════
   PANEL PRINCIPAL
════════════════════════════════════════════════════════════════ */
const InsightsPanel = ({ darkMode }) => {
  const [insights,     setInsights]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [spinning,     setSpinning]     = useState(false);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [lastUpdated,  setLastUpdated]  = useState(null);

  const fetchInsights = async () => {
    try {
      const res = await fetch(`${API}/insights`);
      if (res.ok) setInsights(await res.json());
    } catch {}
    finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    fetchInsights();
    const iv = setInterval(fetchInsights, 60000);
    return () => clearInterval(iv);
  }, []);

  const handleRefresh = () => {
    setSpinning(true);
    setLoading(true);
    setRefreshKey(k => k + 1);   // dispara re-fetch en todas las secciones
    fetchInsights();
    setTimeout(() => setSpinning(false), 700);
  };

  // Formatea "hace X min" o "hace X seg"
  const updatedLabel = lastUpdated
    ? (() => {
        const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
        if (diff < 60) return `hace ${diff}s`;
        return `hace ${Math.floor(diff / 60)}min`;
      })()
    : null;

  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden', borderRadius: '22px',
      background: 'rgba(4,10,20,0.97)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(6,182,212,0.18)',
      boxShadow: '0 0 0 1px rgba(6,182,212,0.05), 0 32px 80px rgba(0,0,0,0.6), 0 8px 24px rgba(6,182,212,0.08)',
      mb: 4,
    }}>
      {/* Scan line */}
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden', borderRadius: 'inherit',
        '&::after': { content: '""', position: 'absolute', left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.22), transparent)',
          animation: 'scan 7s ease-in-out infinite',
          '@keyframes scan': { '0%': { top: '0%', opacity: 0 }, '5%': { opacity: 1 }, '95%': { opacity: 0.4 }, '100%': { top: '100%', opacity: 0 } },
        },
      }} />
      <Box sx={{ position: 'absolute', top: 0, right: 0, width: 300, height: 300, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(circle at top right, rgba(6,182,212,0.07) 0%, transparent 60%)' }} />

      <Box sx={{ position: 'relative', zIndex: 1, p: { xs: 2.5, md: 3.5 } }}>

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: '14px', background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.15))', border: '1px solid rgba(6,182,212,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 24px rgba(6,182,212,0.2)' }}>
              <Brain size={24} color="#06b6d4" strokeWidth={2} />
            </Box>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', background: 'linear-gradient(135deg, #e2e8f0 30%, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  CEO Virtual
                </Typography>
                <Box sx={{ px: 1, py: 0.3, borderRadius: '7px', background: 'linear-gradient(135deg, rgba(6,182,212,0.22), rgba(139,92,246,0.18))', border: '1px solid rgba(6,182,212,0.35)', boxShadow: '0 0 12px rgba(6,182,212,0.15)' }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                    MODO DIOS
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4 }}>
                {[
                  { icon: <Radio size={10} />, l: 'RFM', c: '#8b5cf6' },
                  { icon: <MapPin size={10} />, l: 'Zonas', c: '#10b981' },
                  { icon: <Cloud size={10} />, l: 'Clima Santiago', c: '#38bdf8' },
                  { icon: <Target size={10} />, l: 'Equilibrio', c: '#f59e0b' },
                  { icon: <Cpu size={10} />, l: 'IA', c: '#06b6d4' },
                ].map((t, i, arr) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
                    <Box sx={{ color: t.c, opacity: 0.8, display: 'flex' }}>{t.icon}</Box>
                    <Typography sx={{ fontSize: '0.61rem', color: 'rgba(255,255,255,0.32)', fontWeight: 600, fontFamily: '"DM Sans", system-ui, sans-serif' }}>{t.l}</Typography>
                    {i < arr.length - 1 && <Box sx={{ width: '1px', height: 10, bgcolor: 'rgba(255,255,255,0.09)', ml: 0.35 }} />}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.6, borderRadius: '9px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#10b981', animation: 'pingDot 2s ease-in-out infinite', '@keyframes pingDot': { '0%,100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0.6)' }, '50%': { boxShadow: '0 0 0 5px rgba(16,185,129,0)' } } }} />
              <Typography sx={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', letterSpacing: '0.06em' }}>ONLINE</Typography>
            </Box>
            {/* Botón refresh global — refresca TODAS las secciones */}
            <Box
              onClick={handleRefresh}
              title="Actualizar todo el panel"
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 1.25, py: 0.6, borderRadius: '9px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', transition: 'all 0.25s ease',
                '&:hover': { background: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.28)' },
                '&:active': { transform: 'scale(0.95)' },
              }}
            >
              <RefreshCw
                size={13}
                color={spinning ? '#06b6d4' : 'rgba(255,255,255,0.4)'}
                style={{
                  transition: 'color 0.2s',
                  animation: spinning ? 'spinIcon 0.7s linear infinite' : 'none',
                }}
              />
              {updatedLabel && !spinning && (
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.28)', fontFamily: '"DM Sans", system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                  {updatedLabel}
                </Typography>
              )}
              {spinning && (
                <Typography sx={{ fontSize: '0.6rem', color: '#06b6d4', fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                  actualizando...
                </Typography>
              )}
            </Box>
          </Box>
          <style>{`@keyframes spinIcon { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </Box>

        {/* Header divider */}
        <Box sx={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.2), rgba(139,92,246,0.15), transparent)', mb: 3 }} />

        {/* ── DATA SECTIONS ───────────────────────────────────────── */}
        <FlujoCajaSection  refreshKey={refreshKey} />
        <BriefingSection   refreshKey={refreshKey} />
        <ClimaSection      refreshKey={refreshKey} />
        <EquilibrioSection refreshKey={refreshKey} />
        <RFMSection        refreshKey={refreshKey} />
        <ZonasSection      refreshKey={refreshKey} />
        <HistorialSection  refreshKey={refreshKey} />

        {/* ── AUTONOMOUS INSIGHTS ─────────────────────────────────── */}
        <InsightsAutonomos insights={insights} loading={loading} />
      </Box>
    </Box>
  );
};

export default InsightsPanel;
