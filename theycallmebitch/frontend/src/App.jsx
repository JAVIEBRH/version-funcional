import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Pedidos from './pages/Pedidos';
import Clientes from './pages/Clientes';
import MapaCalor from './pages/MapaCalor';
import Predictor from './pages/Predictor';
import Local from './pages/Local';
import { RefreshProvider, useRefresh } from './context/RefreshContext';
import './App.css';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#3b82f6',
        light: '#60a5fa',
        dark: '#2563eb',
      },
      secondary: {
        main: '#10b981',
        light: '#34d399',
        dark: '#059669',
      },
      background: {
        default: darkMode ? '#0f172a' : '#f8fafc',
        paper: darkMode ? '#1e293b' : '#ffffff',
      },
      text: {
        primary: darkMode ? '#f1f5f9' : '#1e293b',
        secondary: darkMode ? '#94a3b8' : '#64748b',
      },
      divider: darkMode ? '#334155' : '#e2e8f0',
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontWeight: 700,
        fontSize: '2.5rem',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
      },
      h2: {
        fontWeight: 600,
        fontSize: '2rem',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
      },
      h3: {
        fontWeight: 600,
        fontSize: '1.5rem',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
      },
      h4: {
        fontWeight: 600,
        fontSize: '1.25rem',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
      },
      h5: {
        fontWeight: 600,
        fontSize: '1.125rem',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
      },
      h6: {
        fontWeight: 600,
        fontSize: '1rem',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
      },
      body1: {
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
      },
      body2: {
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
        fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: darkMode 
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)'
              : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              boxShadow: darkMode 
                ? '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)'
                : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              transform: 'translateY(-2px)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontWeight: 500,
          },
        },
      },
    },
  });

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const AppContent = () => {
    const { isRefreshing, handleRefresh } = useRefresh();

    return (
      <Box sx={{ 
        display: 'flex', 
        minHeight: '100vh',
        bgcolor: 'background.default',
        transition: 'all 0.3s ease-in-out'
      }}>
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
            transition: 'all 0.3s ease-in-out',
            marginLeft: sidebarOpen ? '240px' : '64px',
            '@media (max-width: 768px)': {
              marginLeft: 0,
            },
          }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/mapa-calor" element={<MapaCalor />} />
            <Route path="/predictor" element={<Predictor />} />
            <Route path="/local" element={<Local />} />
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
      </RefreshProvider>
    </ThemeProvider>
  );
}

export default App; 