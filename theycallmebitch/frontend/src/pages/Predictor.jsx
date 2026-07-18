import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, CircularProgress } from '@mui/material';
import PredictorDemandaCard from '../components/PredictorDemandaCard';
import PredictorClientesRiesgoCard from '../components/PredictorClientesRiesgoCard';
import { getPredictorDemanda, getPredictorClientesRiesgo } from '../services/api';

export default function Predictor() {
  const theme = useTheme();
  const [demanda, setDemanda] = useState(null);
  const [riesgo, setRiesgo] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarDatos = async () => {
    try {
      const [demandaData, riesgoData] = await Promise.all([
        getPredictorDemanda(),
        getPredictorClientesRiesgo(),
      ]);
      setDemanda(demandaData);
      setRiesgo(riesgoData);
    } catch (error) {
      console.error('Error cargando datos del predictor:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    const interval = setInterval(cargarDatos, 10 * 60 * 1000);
    const handleGlobalRefresh = () => cargarDatos();
    window.addEventListener('globalRefresh', handleGlobalRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('globalRefresh', handleGlobalRefresh);
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 1.5 }}>
        <CircularProgress size={22} thickness={4} sx={{ color: '#06b6d4' }} />
        <Typography sx={{ color: theme.palette.text.secondary }}>Cargando predictor…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'background.default', minHeight: '100vh' }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Box sx={{ mb: 3 }}>
          <Typography sx={{
            fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.85rem' },
            color: theme.palette.text.primary, letterSpacing: '-0.02em',
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          }}>
            Predictor
          </Typography>
          <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.9rem', mt: 0.3 }}>
            Qué esperar los próximos días, y a quién no perder
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <PredictorDemandaCard data={demanda} />
          <PredictorClientesRiesgoCard data={riesgo} />
        </Box>
      </Box>
    </Box>
  );
}
