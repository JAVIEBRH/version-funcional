import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Pedidos from './pages/Pedidos';
import Clientes from './pages/Clientes';
import { RefreshProvider, useRefresh } from './context/RefreshContext';
import ChatAssistant from './components/ChatAssistant';
import './App.css';

const MapaCalor = lazy(() => import('./pages/MapaCalor'));
const Predictor = lazy(() => import('./pages/Predictor'));
const Local      = lazy(() => import('./pages/Local'));

const LoadingSpinner = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
    <CircularProgress size={44} thickness={3} sx={{ color: 'primary.main' }} />
  </Box>
);

/* ── Animated background orbs ────────────────────────────────────── */
const BackgroundOrbs = ({ isDark }) => (
  <Box sx={{
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 0,
  }}>
    {/* Primary orb — top-left, cyan */}
    <Box sx={{
      position: 'absolute',
      top: '-8%', left: '-6%',
      width: 680, height: 680,
      borderRadius: '50%',
      background: isDark
        ? 'radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 68%)'
        : 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 68%)',
      animation: 'orbFloat1 22s ease-in-out infinite',
      '@keyframes orbFloat1': {
        '0%,100%': { transform: 'translate(0,0) scale(1)' },
        '25%':     { transform: 'translate(28px,-22px) scale(1.06)' },
        '50%':     { transform: 'translate(-12px,26px) scale(0.96)' },
        '75%':     { transform: 'translate(20px,12px) scale(1.03)' },
      },
    }} />

    {/* Secondary orb — bottom-right, teal */}
    <Box sx={{
      position: 'absolute',
      bottom: '5%', right: '-8%',
      width: 520, height: 520,
      borderRadius: '50%',
      background: isDark
        ? 'radial-gradient(circle, rgba(13,148,136,0.07) 0%, transparent 68%)'
        : 'radial-gradient(circle, rgba(13,148,136,0.05) 0%, transparent 68%)',
      animation: 'orbFloat2 28s ease-in-out infinite',
      '@keyframes orbFloat2': {
        '0%,100%': { transform: 'translate(0,0) scale(1)' },
        '33%':     { transform: 'translate(-34px,-28px) scale(1.08)' },
        '66%':     { transform: 'translate(22px,18px) scale(0.94)' },
      },
    }} />

    {/* Tertiary orb — center, faint cyan */}
    <Box sx={{
      position: 'absolute',
      top: '45%', left: '42%',
      width: 440, height: 440,
      borderRadius: '50%',
      background: isDark
        ? 'radial-gradient(circle, rgba(6,182,212,0.035) 0%, transparent 68%)'
        : 'none',
      animation: 'orbFloat3 34s ease-in-out infinite',
      '@keyframes orbFloat3': {
        '0%,100%': { transform: 'translate(0,0)' },
        '50%':     { transform: 'translate(-20px,-36px)' },
      },
    }} />
  </Box>
);

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  /* ── Design Tokens ─────────────────────────────────────────────── */
  const tokens = {
    dark: {
      primary:       '#06b6d4',   /* cyan-500 — water              */
      secondary:     '#0d9488',   /* teal-600 — water accent       */
      bgDefault:     '#040a14',   /* deep ocean black              */
      bgPaper:       'rgba(255,255,255,0.042)',
      border:        'rgba(255,255,255,0.09)',
      textPrimary:   '#e2e8f0',
      textSecondary: '#64748b',
      gradient: 'none',
    },
    light: {
      primary:       '#0891b2',   /* cyan-600                      */
      secondary:     '#0f766e',   /* teal-700                      */
      bgDefault:     '#edf2f8',
      bgPaper:       'rgba(255,255,255,0.88)',
      border:        'rgba(0,0,0,0.07)',
      textPrimary:   '#0a1628',
      textSecondary: '#64748b',
      gradient: 'none',
    }
  };
  const t = darkMode ? tokens.dark : tokens.light;

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary:   { main: t.primary,   light: darkMode ? '#22d3ee' : '#06b6d4', dark: darkMode ? '#0e7490' : '#0e7490' },
      secondary: { main: t.secondary, light: darkMode ? '#14b8a6' : '#0d9488', dark: darkMode ? '#0f766e' : '#115e59' },
      background: { default: t.bgDefault, paper: t.bgPaper },
      text:       { primary: t.textPrimary, secondary: t.textSecondary },
      divider:    darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
      error:   { main: '#ef4444', light: '#fca5a5', dark: '#b91c1c' },
      warning: { main: '#f59e0b', light: '#fcd34d', dark: '#b45309' },
      success: { main: '#10b981', light: '#6ee7b7', dark: '#047857' },
      info:    { main: '#06b6d4', light: '#67e8f9', dark: '#0e7490' },
    },
    typography: {
      fontFamily: '"Plus Jakarta Sans", "DM Sans", system-ui, sans-serif',
      h1: { fontWeight: 800, fontSize: '2.5rem',  letterSpacing: '-0.035em', lineHeight: 1.1  },
      h2: { fontWeight: 800, fontSize: '2rem',    letterSpacing: '-0.03em'  },
      h3: { fontWeight: 750, fontSize: '1.75rem', letterSpacing: '-0.025em' },
      h4: { fontWeight: 700, fontSize: '1.5rem',  letterSpacing: '-0.022em' },
      h5: { fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.018em' },
      h6: { fontWeight: 650, fontSize: '1rem',    letterSpacing: '-0.012em' },
      body1: { fontFamily: '"DM Sans", system-ui, sans-serif', lineHeight: 1.65 },
      body2: { fontFamily: '"DM Sans", system-ui, sans-serif', lineHeight: 1.6 },
      caption: { fontFamily: '"DM Sans", system-ui, sans-serif', letterSpacing: '0.01em' },
      overline: { letterSpacing: '0.1em', fontWeight: 700, fontSize: '0.65rem' },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' },
    },
    shape: { borderRadius: 16 },
    components: {
      MuiCssBaseline: {
        styleOverrides: `
          body {
            background-color: ${t.bgDefault};
            background-attachment: fixed;
            font-variant-numeric: tabular-nums;
          }
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb {
            background: ${darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.11)'};
            border-radius: 99px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: ${darkMode ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.19)'};
          }
          ::selection {
            background: ${darkMode ? 'rgba(6,182,212,0.28)' : 'rgba(8,145,178,0.2)'};
            color: ${t.textPrimary};
          }
        `,
      },

      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: darkMode ? 'rgba(255,255,255,0.042)' : 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid ${t.border}`,
            boxShadow: darkMode
              ? '0 1px 2px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.35), 0 12px 48px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 1px 3px rgba(0,0,0,0.05), 0 4px 20px rgba(0,0,0,0.07)',
            transition: 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease, border-color 0.3s ease',
            '&:hover': {
              transform: 'translateY(-6px)',
              borderColor: darkMode ? 'rgba(6,182,212,0.28)' : 'rgba(8,145,178,0.22)',
              boxShadow: darkMode
                ? '0 2px 4px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.42), 0 20px 64px rgba(6,182,212,0.1), inset 0 1px 0 rgba(255,255,255,0.07)'
                : '0 4px 16px rgba(0,0,0,0.09), 0 12px 40px rgba(8,145,178,0.13)',
            },
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            backgroundColor: darkMode ? 'rgba(255,255,255,0.044)' : 'rgba(255,255,255,0.90)',
            border: `1px solid ${t.border}`,
          },
        },
      },

      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            padding: '9px 22px',
            boxShadow: 'none',
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            fontWeight: 600,
            letterSpacing: '0.01em',
            transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            '&:hover': {
              boxShadow: darkMode
                ? '0 0 0 1px rgba(6,182,212,0.35), 0 4px 20px rgba(6,182,212,0.18)'
                : '0 4px 14px rgba(8,145,178,0.24)',
              transform: 'translateY(-2px)',
            },
            '&:active': { transform: 'translateY(0)' },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 700,
            fontSize: '0.72rem',
            letterSpacing: '0.01em',
            height: 24,
            backdropFilter: 'blur(4px)',
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          },
          label: { paddingLeft: 9, paddingRight: 9 },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 99,
            height: 5,
            backgroundColor: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
          },
          bar: { borderRadius: 99 },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: darkMode ? 'rgba(4,10,20,0.97)' : 'rgba(10,22,40,0.92)',
            color: '#e2e8f0',
            fontSize: '0.76rem',
            fontWeight: 500,
            fontFamily: '"DM Sans", system-ui, sans-serif',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            padding: '6px 12px',
          },
          arrow: { color: 'rgba(4,10,20,0.97)' },
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: t.border,
            opacity: 1,
          },
        },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: darkMode ? 'rgba(4,10,20,0.94)' : 'rgba(255,255,255,0.93)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRight: `1px solid ${t.border}`,
          },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          head: { fontWeight: 700, letterSpacing: '0.06em', fontSize: '0.72rem', textTransform: 'uppercase', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' },
          root: { borderColor: t.border, fontFamily: '"DM Sans", system-ui, sans-serif' },
        },
      },

      MuiInputBase: {
        styleOverrides: {
          root: {
            borderRadius: '12px !important',
            backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            fontFamily: '"DM Sans", system-ui, sans-serif',
          },
        },
      },
    },
  });

  const toggleDarkMode = () => setDarkMode(prev => !prev);
  const isDark = darkMode;

  const AppContent = () => {
    const { isRefreshing, handleRefresh } = useRefresh();
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', transition: 'background-color 0.4s ease', position: 'relative' }}>
        {/* Animated background orbs */}
        <BackgroundOrbs isDark={isDark} />

        <Sidebar
          open={sidebarOpen}
          setOpen={setSidebarOpen}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            transition: 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',
            marginLeft: sidebarOpen ? '248px' : '64px',
            position: 'relative',
            zIndex: 1,
            '@media (max-width: 768px)': { marginLeft: 0 },
          }}
        >
          <Routes>
            <Route path="/"           element={<Home />} />
            <Route path="/pedidos"    element={<Pedidos />} />
            <Route path="/clientes"   element={<Clientes />} />
            <Route path="/mapa-calor" element={<Suspense fallback={<LoadingSpinner />}><MapaCalor /></Suspense>} />
            <Route path="/predictor"  element={<Suspense fallback={<LoadingSpinner />}><Predictor /></Suspense>} />
            <Route path="/local"      element={<Suspense fallback={<LoadingSpinner />}><Local /></Suspense>} />
          </Routes>
        </Box>
      </Box>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RefreshProvider>
        <AppContent />
        <ChatAssistant darkMode={darkMode} />
      </RefreshProvider>
    </ThemeProvider>
  );
}

export default App;
