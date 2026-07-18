import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Divider, IconButton, Tooltip, useTheme, Drawer, AppBar,
  Toolbar, Typography, Switch
} from '@mui/material';
import {
  Home, ShoppingCart, People, Map, TrendingUp, LocationOn,
  Menu, DarkMode, LightMode, Refresh, WaterDrop
} from '@mui/icons-material';

const CYAN   = '#06b6d4';
const VIOLET = '#0d9488';
const EMERALD = '#10b981';

/* ── Animated water drop logo ─────────────────────────────────── */
const WaterLogo = ({ isDark }) => (
  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
    <defs>
      <linearGradient id="lg1" x1="0" y1="0" x2="38" y2="38" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor={CYAN} />
        <stop offset="100%" stopColor={VIOLET} />
      </linearGradient>
      <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Pill background */}
    <rect width="38" height="38" rx="12" fill="url(#lg1)" opacity={isDark ? 0.18 : 0.12} />
    <rect width="38" height="38" rx="12" fill="url(#lg1)" opacity="0.07" />
    {/* Drop */}
    <path
      d="M19 6 C19 6 11 15.5 11 20.5 C11 24.64 14.58 28 19 28 C23.42 28 27 24.64 27 20.5 C27 15.5 19 6 19 6Z"
      fill="url(#lg1)" opacity="0.95" filter="url(#glow)"
    />
    {/* Inner shine */}
    <ellipse cx="16" cy="18.5" rx="2.2" ry="3.5" fill="white" opacity="0.4" transform="rotate(-20 16 18.5)" />
    {/* Bottom rim */}
    <ellipse cx="19" cy="25" rx="3.5" ry="1.2" fill="white" opacity="0.12" />
  </svg>
);

/* ── Nav items ─────────────────────────────────────────────────── */
const NAV = [
  { text: 'Dashboard',   short: 'Inicio',    icon: Home,         path: '/',           color: CYAN   },
  { text: 'Pedidos',     short: 'Pedidos',   icon: ShoppingCart, path: '/pedidos',    color: '#3b82f6' },
  { text: 'Clientes',    short: 'Clientes',  icon: People,       path: '/clientes',   color: VIOLET },
  { text: 'Mapa de Calor',short:'Mapa',      icon: Map,          path: '/mapa-calor', color: '#f59e0b' },
  { text: 'Predictor',   short: 'Predictor', icon: TrendingUp,   path: '/predictor',  color: EMERALD },
  { text: 'Local',       short: 'Local',     icon: LocationOn,   path: '/local',      color: '#f43f5e' },
];

export default function Sidebar({ open, setOpen, darkMode, toggleDarkMode, onRefresh, isRefreshing = false }) {
  const location = useLocation();
  const theme    = useTheme();
  const isDark   = theme.palette.mode === 'dark';
  const [time, setTime]   = useState(new Date());
  // Estado propio del drawer temporal (móvil) — independiente de `open`,
  // que controla el ancho del sidebar de escritorio. Compartir un solo
  // estado entre ambos dejaba el Drawer temporal "abierto" por defecto
  // en desktop (aunque oculto por CSS), y MUI bloqueaba el scroll del
  // body permanentemente (`body { overflow: hidden }`) sin importar que
  // el drawer no fuera visible.
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const timeStr = time.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });

  const sidebarBg = isDark
    ? 'linear-gradient(180deg, rgba(7,13,26,0.72) 0%, rgba(8,15,31,0.74) 60%, rgba(6,16,28,0.76) 100%)'
    : 'linear-gradient(180deg, rgba(248,250,252,0.78) 0%, rgba(241,245,249,0.8) 100%)';

  const drawer = (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: sidebarBg,
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: 'auto',
      boxShadow: isDark
        ? 'inset -1px 0 0 rgba(255,255,255,0.05), 6px 0 32px rgba(0,0,0,0.35), 12px 0 64px rgba(0,0,0,0.18)'
        : 'inset -1px 0 0 rgba(0,0,0,0.05), 6px 0 24px rgba(0,0,0,0.06), 12px 0 48px rgba(0,0,0,0.03)',
      '&::before': isDark ? {
        content: '""',
        position: 'absolute',
        top: -80, left: -80,
        width: 220, height: 220,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${CYAN}18 0%, transparent 70%)`,
        pointerEvents: 'none',
        animation: 'sidebarOrbFloat1 16s ease-in-out infinite',
        '@keyframes sidebarOrbFloat1': {
          '0%,100%': { transform: 'translate(0,0)' },
          '50%':     { transform: 'translate(14px,18px)' },
        },
      } : {},
      '&::after': isDark ? {
        content: '""',
        position: 'absolute',
        bottom: -60, right: -60,
        width: 180, height: 180,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${VIOLET}14 0%, transparent 70%)`,
        pointerEvents: 'none',
        animation: 'sidebarOrbFloat2 20s ease-in-out infinite',
        '@keyframes sidebarOrbFloat2': {
          '0%,100%': { transform: 'translate(0,0)' },
          '50%':     { transform: 'translate(-12px,-16px)' },
        },
      } : {},
    }}>

      {/* ── Brand ────────────────────────────────────────────────── */}
      <Box sx={{ px: 2.5, pt: 2.5, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5, position: 'relative' }}>
        <Box sx={{
          flexShrink: 0,
          filter: isDark ? `drop-shadow(0 0 10px ${CYAN}60)` : 'none',
          animation: 'logoFloat 5s ease-in-out infinite',
          '@keyframes logoFloat': {
            '0%,100%': { transform: 'translateY(0)' },
            '50%':     { transform: 'translateY(-3px)' },
          },
        }}>
          <WaterLogo isDark={isDark} />
        </Box>
        <Box>
          <Typography sx={{
            fontWeight: 800, fontSize: '1rem', lineHeight: 1.15, letterSpacing: '-0.03em',
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            background: isDark
              ? `linear-gradient(135deg, #f1f5f9 20%, ${CYAN})`
              : `linear-gradient(135deg, #0a1628, #1e40af)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Aguas Ancud
          </Typography>
          <Typography sx={{
            fontSize: '0.64rem', fontWeight: 500, letterSpacing: '0.04em',
            color: isDark ? 'rgba(148,163,184,0.7)' : 'rgba(71,85,105,0.7)',
            fontFamily: '"DM Sans", system-ui, sans-serif',
            textTransform: 'uppercase',
          }}>
            Panel de Control
          </Typography>
        </Box>
      </Box>

      {/* ── Time widget ──────────────────────────────────────────── */}
      <Box sx={{ px: 2, pb: 2 }}>
        <Box sx={{
          borderRadius: '14px', px: 2, py: 1.25,
          background: isDark
            ? `linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.06))`
            : `linear-gradient(135deg, rgba(6,182,212,0.06), rgba(139,92,246,0.04))`,
          border: `1px solid ${isDark ? 'rgba(6,182,212,0.15)' : 'rgba(6,182,212,0.12)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Box>
            <Typography sx={{
              fontSize: '1.25rem', fontWeight: 800, lineHeight: 1,
              letterSpacing: '-0.04em',
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              color: isDark ? '#e2e8f0' : '#0f172a',
            }}>
              {timeStr}
            </Typography>
            <Typography sx={{
              fontSize: '0.67rem', fontWeight: 500, mt: 0.3,
              color: isDark ? 'rgba(148,163,184,0.65)' : 'rgba(71,85,105,0.65)',
              fontFamily: '"DM Sans", system-ui, sans-serif',
              textTransform: 'capitalize',
            }}>
              {dateStr}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{
                width: 6, height: 6, borderRadius: '50%', bgcolor: EMERALD,
                boxShadow: `0 0 8px ${EMERALD}`,
                animation: 'pulse 2.4s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%,100%': { opacity: 1, transform: 'scale(1)' },
                  '50%':     { opacity: 0.6, transform: 'scale(0.85)' },
                },
              }} />
              <Typography sx={{ fontSize: '0.6rem', color: EMERALD, fontWeight: 700, letterSpacing: '0.04em' }}>
                ONLINE
              </Typography>
            </Box>
            <Tooltip title="Actualizar datos" placement="right" arrow>
              <IconButton
                onClick={onRefresh} disabled={isRefreshing} size="small"
                sx={{
                  width: 26, height: 26, borderRadius: '8px',
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  color: isRefreshing ? CYAN : isDark ? 'rgba(148,163,184,0.5)' : 'rgba(71,85,105,0.5)',
                  '&:hover': { bgcolor: `${CYAN}20`, color: CYAN },
                  '&:disabled': { color: CYAN, opacity: 0.9 },
                }}
              >
                <Refresh sx={{
                  fontSize: 13,
                  animation: isRefreshing ? 'spin 0.9s linear infinite' : 'none',
                  '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
                }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <Box sx={{ mx: 2, mb: 1.5 }}>
        <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }} />
      </Box>

      {/* ── Nav label ────────────────────────────────────────────── */}
      <Box sx={{ px: 2.5, pb: 0.75 }}>
        <Typography sx={{
          fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: isDark ? 'rgba(148,163,184,0.35)' : 'rgba(71,85,105,0.4)',
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        }}>
          Menú
        </Typography>
      </Box>

      {/* ── Nav items ────────────────────────────────────────────── */}
      <List sx={{ flexGrow: 1, px: 1.5, pt: 0, pb: 1 }}>
        {NAV.map((item, idx) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <ListItem
              key={item.text}
              disablePadding
              sx={{
                mb: 0.5,
                animation: `slideIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both`,
                animationDelay: `${idx * 0.045}s`,
                '@keyframes slideIn': {
                  from: { opacity: 0, transform: 'translateX(-12px)' },
                  to:   { opacity: 1, transform: 'translateX(0)' },
                },
              }}
            >
              <ListItemButton
                component={Link}
                to={item.path}
                sx={{
                  borderRadius: '13px', py: 1, px: 1.25,
                  position: 'relative', overflow: 'hidden',
                  transition: 'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',
                  /* Active: gradient pill, floats slightly above the sidebar surface */
                  background: isActive
                    ? isDark
                      ? `linear-gradient(135deg, ${item.color}22, ${item.color}0d)`
                      : `linear-gradient(135deg, ${item.color}16, ${item.color}08)`
                    : 'transparent',
                  border: isActive
                    ? `1px solid ${item.color}35`
                    : '1px solid transparent',
                  boxShadow: isActive
                    ? isDark
                      ? `0 4px 18px ${item.color}22, 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 ${item.color}20`
                      : `0 4px 14px ${item.color}18, inset 0 1px 0 ${item.color}18`
                    : 'none',
                  /* Hover shimmer */
                  '&::after': {
                    content: '""', position: 'absolute', inset: 0,
                    background: `linear-gradient(90deg, transparent, ${item.color}08, transparent)`,
                    transform: 'translateX(-100%)',
                    transition: 'transform 0.5s ease',
                    borderRadius: '13px',
                  },
                  '&:hover::after': { transform: 'translateX(100%)' },
                  '&:hover': {
                    background: isActive
                      ? isDark ? `linear-gradient(135deg, ${item.color}28, ${item.color}12)` : `linear-gradient(135deg, ${item.color}20, ${item.color}0c)`
                      : isDark ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.04)',
                    transform: 'translateY(-2px) translateX(2px)',
                    border: `1px solid ${isActive ? item.color + '50' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}`,
                    boxShadow: isDark
                      ? `0 6px 18px ${item.color}20, 0 2px 6px rgba(0,0,0,0.3)`
                      : `0 6px 16px ${item.color}16`,
                    '& .nav-icon-box': { transform: 'scale(1.08)' },
                  },
                }}
              >
                {/* Icon container */}
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Box className="nav-icon-box" sx={{
                    width: 32, height: 32, borderRadius: '9px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive
                      ? isDark
                        ? `linear-gradient(135deg, ${item.color}35, ${item.color}20)`
                        : `linear-gradient(135deg, ${item.color}22, ${item.color}12)`
                      : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    border: isActive
                      ? `1px solid ${item.color}45`
                      : `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
                    boxShadow: isActive && isDark ? `0 0 12px ${item.color}30` : 'none',
                    transition: 'all 0.22s ease',
                  }}>
                    <Icon sx={{
                      fontSize: 16,
                      color: isActive ? item.color : isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.65)',
                      transition: 'color 0.2s ease',
                      filter: isActive && isDark ? `drop-shadow(0 0 4px ${item.color}80)` : 'none',
                    }} />
                  </Box>
                </ListItemIcon>

                <ListItemText
                  primary={item.text}
                  sx={{
                    '& .MuiTypography-root': {
                      fontSize: '0.83rem',
                      fontWeight: isActive ? 700 : 500,
                      letterSpacing: isActive ? '-0.01em' : '0em',
                      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                      color: isActive
                        ? isDark ? '#f1f5f9' : '#0f172a'
                        : isDark ? 'rgba(148,163,184,0.7)' : 'rgba(71,85,105,0.75)',
                      transition: 'all 0.2s ease',
                    },
                  }}
                />

                {/* Active tag */}
                {isActive && (
                  <Box sx={{
                    px: 0.75, py: 0.2, borderRadius: '6px',
                    background: `${item.color}22`,
                    border: `1px solid ${item.color}40`,
                    flexShrink: 0,
                  }}>
                    <Box sx={{
                      width: 5, height: 5, borderRadius: '50%',
                      bgcolor: item.color,
                      boxShadow: `0 0 6px ${item.color}`,
                      animation: 'breathe 2.2s ease-in-out infinite',
                      '@keyframes breathe': {
                        '0%,100%': { opacity: 1 },
                        '50%':     { opacity: 0.5 },
                      },
                    }} />
                  </Box>
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* ── Theme toggle ─────────────────────────────────────────── */}
      <Box sx={{ mx: 2, mb: 0.5 }}>
        <Divider sx={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' }} />
      </Box>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 1.5, py: 0.9, borderRadius: '12px',
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 26, height: 26, borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: darkMode ? 'rgba(139,92,246,0.12)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${darkMode ? 'rgba(139,92,246,0.2)' : 'rgba(245,158,11,0.18)'}`,
            }}>
              {darkMode
                ? <DarkMode sx={{ fontSize: 13, color: VIOLET }} />
                : <LightMode sx={{ fontSize: 13, color: '#f59e0b' }} />
              }
            </Box>
            <Typography sx={{
              fontSize: '0.74rem', fontWeight: 600,
              color: isDark ? 'rgba(148,163,184,0.7)' : 'rgba(71,85,105,0.75)',
              fontFamily: '"DM Sans", system-ui, sans-serif',
            }}>
              {darkMode ? 'Oscuro' : 'Claro'}
            </Typography>
          </Box>
          <Switch
            checked={darkMode} onChange={toggleDarkMode} size="small"
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: VIOLET },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: VIOLET, opacity: 0.5 },
            }}
          />
        </Box>
      </Box>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <Box sx={{
        mx: 2, mb: 2, px: 1.5, py: 1,
        textAlign: 'center',
      }}>
        <Typography sx={{
          fontSize: '0.6rem', fontWeight: 500,
          color: isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.45)',
          fontFamily: '"DM Sans", system-ui, sans-serif',
          letterSpacing: '0.01em',
        }}>
          Dashboard v2.0 · Puente Alto
        </Typography>
      </Box>

    </Box>
  );

  return (
    <>
      {/* ── Mobile AppBar ─────────────────────────────────────────── */}
      <AppBar
        position="fixed" elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          display: { xs: 'flex', md: 'none' },
          bgcolor: isDark ? 'rgba(7,13,26,0.94)' : 'rgba(248,250,252,0.95)',
          backdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
          color: theme.palette.text.primary,
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2 }}>
            <Menu />
          </IconButton>
          <Typography variant="h6" noWrap sx={{
            flexGrow: 1, fontWeight: 800, fontSize: '1rem',
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            letterSpacing: '-0.02em',
          }}>
            Aguas Ancud
          </Typography>
          <Tooltip title={`Modo ${darkMode ? 'claro' : 'oscuro'}`} arrow>
            <IconButton onClick={toggleDarkMode} color="inherit" size="small">
              {darkMode ? <LightMode sx={{ fontSize: 20 }} /> : <DarkMode sx={{ fontSize: 20 }} />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* ── Desktop Sidebar ───────────────────────────────────────── */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            width: 248,
            boxSizing: 'border-box',
            overflowX: 'hidden',
            border: 'none',
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'}`,
            background: 'transparent',
          },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* ── Mobile Sidebar ────────────────────────────────────────── */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: 248, boxSizing: 'border-box', border: 'none' },
        }}
      >
        {drawer}
      </Drawer>
    </>
  );
}
