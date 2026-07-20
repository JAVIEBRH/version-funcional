import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  Divider,
  Alert,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  ShoppingCart,
  People,
  Inventory,
  Info
} from '@mui/icons-material';
// Importar los mismos componentes del dashboard principal
import VentasCard from '../components/VentasCard';
import VentasMensualesCard from '../components/VentasMensualesCard';
import VentasMensualesLocalCard from '../components/VentasMensualesLocalCard';
import VentasSemanalesCard from '../components/VentasSemanalesCard';
import VentasSemanalesLocalCard from '../components/VentasSemanalesLocalCard';
import VentasDiariasCard from '../components/VentasDiariasCard';
import VentasDiariasLocalCard from '../components/VentasDiariasLocalCard';
import VentasTotalesLocalCard from '../components/VentasTotalesLocalCard';
import TicketPromedioCard from '../components/TicketPromedioCard';
import KpiMetaCard from '../components/KpiMetaCard';
import MetodosPagoLocalCard from '../components/MetodosPagoLocalCard';
import './Local.css';
import { getVentasLocales } from '../services/api';


  // Función para obtener datos del endpoint
  const obtenerDatosVentasLocales = async () => {
    try {
      console.log('🔍 Iniciando fetch del endpoint local...');
      const data = await getVentasLocales();
      
      console.log('📊 Respuesta del endpoint local:', data);
      console.log('📊 Ventas totales:', data.ventas_totales);
      console.log('📊 Ventas del mes:', data.ventas_mes);
      console.log('📊 Ventas de la semana:', data.ventas_semana);
      console.log('📊 Ventas de hoy:', data.ventas_hoy);
      
      if (data && data.ventas_totales !== undefined) {
        console.log('✅ Datos válidos, procesando...');
        return data;
      } else {
        console.error('❌ Error en la respuesta del endpoint:', data);
        return {
          ventas_totales: 0,
          ventas_mes: 0,
          ventas_semana: 0,
          ventas_hoy: 0,
          bidones_totales: 0,
          bidones_mes: 0,
          bidones_semana: 0,
          bidones_hoy: 0,
          ticket_promedio: 0,
          metodos_pago: {},
          ventas_diarias: [],
          ventas_semanales: [],
          ventas_mensuales: [],
          total_transacciones: 0,
          clientes_unicos: 0
        };
      }
    } catch (error) {
      console.error('❌ Error obteniendo datos de ventas locales:', error);
      return {
        ventas_totales: 0,
        ventas_mes: 0,
        ventas_semana: 0,
        ventas_hoy: 0,
        bidones_totales: 0,
        bidones_mes: 0,
        bidones_semana: 0,
        bidones_hoy: 0,
        ticket_promedio: 0,
        metodos_pago: {},
        ventas_diarias: [],
        ventas_semanales: [],
        ventas_mensuales: [],
        total_transacciones: 0,
        clientes_unicos: 0
      };
    }
  };

export default function Local() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [localData, setLocalData] = useState({
    // Datos de venta del local (se actualizarán con datos reales)
    ventasHoy: 0,
    ventasSemana: 0,
    ventasMes: 0,
    ventasAnio: 0,
    
    // Datos de comparación del mes anterior
    ventasHoyMesPasado: 0,
    ventasSemanaMesPasado: 0,
    ventasMesPasado: 0,
    ventasAnioPasado: 0,
    
    // Métricas de clientes
    clientesHoy: 0,
    clientesSemana: 0,
    clientesMes: 0,
    clientesAnio: 0,
    clientesMesPasado: 0,
    
    // Métricas de productos
    bidonesVendidosHoy: 0,
    bidonesVendidosSemana: 0,
    bidonesVendidosMes: 0,
    bidonesVendidosAnio: 0,
    bidonesVendidosMesPasado: 0,
    
    // Métricas de eficiencia
    ticketPromedio: 0,
    ticketPromedioMesPasado: 0,
    eficienciaVentas: 0,
    satisfaccionClientes: 0,
    tiempoAtencion: 0,
    
    // Historial de ventas por día (últimos 7 días)
    ventasDiarias: [
      { dia: 'Lunes', ventas: 0, clientes: 0, bidones: 0 },
      { dia: 'Martes', ventas: 0, clientes: 0, bidones: 0 },
      { dia: 'Miércoles', ventas: 0, clientes: 0, bidones: 0 },
      { dia: 'Jueves', ventas: 0, clientes: 0, bidones: 0 },
      { dia: 'Viernes', ventas: 0, clientes: 0, bidones: 0 },
      { dia: 'Sábado', ventas: 0, clientes: 0, bidones: 0 },
      { dia: 'Domingo', ventas: 0, clientes: 0, bidones: 0 }
    ],

    // Tendencias reales para las tarjetas de resumen
    tendenciaMensualReal: [],
    tendenciaSemanalReal: [],
    tendenciaDiariaReal: [],

    // Productos más vendidos
    productosTop: [],
    
    // Métodos de pago utilizados
    metodosPago: {},
    totalTransacciones: 0,
    
    // Personal del local
    personal: []
  });

  useEffect(() => {
    const cargarDatosLocales = async () => {
      try {
        setLoading(true);
        const datosProcesados = await obtenerDatosVentasLocales();
        
        // Debug: Ver qué datos están llegando
        console.log('Datos procesados:', datosProcesados);
        console.log('Ventas del mes actual:', datosProcesados.ventas_mes);
        console.log('Bidones vendidos este mes:', datosProcesados.bidones_mes);
        console.log('Ventas diarias array:', datosProcesados.ventas_diarias);
        console.log('Longitud del array de ventas diarias:', datosProcesados.ventas_diarias?.length);
        console.log('Datos procesados completos:', datosProcesados);
        console.log('Número total de transacciones:', datosProcesados.total_transacciones);
        
        // Actualizar el estado con los datos reales del LOCAL
        setLocalData(prevData => ({
          ...prevData,
          // Ventas del LOCAL (solo datos del endpoint local)
          ventasHoy: datosProcesados.ventas_hoy,
          ventasSemana: datosProcesados.ventas_semana,
          ventasMes: datosProcesados.ventas_mes,
          ventasAnio: datosProcesados.ventas_totales,
          
          // Bidones vendidos en el LOCAL
          bidonesVendidosHoy: datosProcesados.bidones_hoy,
          bidonesVendidosSemana: datosProcesados.bidones_semana,
          bidonesVendidosMes: datosProcesados.bidones_mes,
          bidonesVendidosAnio: datosProcesados.bidones_totales,
          
          // Ticket promedio del LOCAL
          ticketPromedio: datosProcesados.ticket_promedio,
          
          // Número de transacciones del LOCAL
          clientesMes: datosProcesados.total_transacciones,
          // El backend no entrega un conteo de transacciones por día (solo ventas y
          // bidones), así que no hay forma de mostrar un número real aquí todavía.
          // Antes se "estimaba" como 1 si hubo ventas ese día, lo cual era inventado.
          clientesHoy: 0,

          // Comparación con el mes anterior: dato real del backend.
          // (Backend no calcula todavía un "mismo día/semana del mes anterior" para
          // el local, así que esas dos comparaciones puntuales quedan en 0 por ahora
          // en vez de aproximar con una fórmula inventada.)
          ventasMesPasado: datosProcesados.ventas_mes_pasado || 0,
          ventasHoyMesPasado: 0,
          ventasSemanaMesPasado: 0,
          ventasAnioPasado: 0,
          clientesMesPasado: datosProcesados.total_transacciones_mes_pasado || 0,
          bidonesVendidosMesPasado: datosProcesados.bidones_mes_pasado || 0,
          ticketPromedioMesPasado: datosProcesados.ticket_promedio_mes_pasado || 0,
          
          // Datos de ventas diarias para el gráfico
          ventasDiarias: datosProcesados.ventas_diarias || [],

          // Tendencias reales entregadas por el backend, para las tarjetas de resumen
          // (el backend las entrega de más reciente a más antigua, por eso se invierten)
          tendenciaMensualReal: [...(datosProcesados.ventas_mensuales || [])].reverse(),
          tendenciaSemanalReal: [...(datosProcesados.ventas_semanales || [])].reverse(),
          tendenciaDiariaReal: datosProcesados.ventas_diarias || [],

          // Métodos de pago: el backend solo entrega conteo de transacciones por método
          // (no un monto por método), así que se pasa el diccionario crudo tal cual.
          metodosPago: datosProcesados.metodos_pago || {},
          totalTransacciones: datosProcesados.total_transacciones || 0,
        }));
      } catch (error) {
        console.error('Error cargando datos locales:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarDatosLocales();
    
    // Actualización automática cada 10 minutos
    const interval = setInterval(cargarDatosLocales, 10 * 60 * 1000);

    // Escuchar evento de actualización global
    const handleGlobalRefresh = () => {
      console.log('Actualización global detectada en Local...');
      cargarDatosLocales();
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('globalRefresh', handleGlobalRefresh);
    };
  }, []);

  // Función para calcular porcentaje de cambio
  const calcularPorcentajeCambio = (actual, anterior) => {
    if (anterior === 0) return actual > 0 ? 100 : 0;
    return ((actual - anterior) / anterior) * 100;
  };

  // Escala del gráfico de ventas diarias: se adapta al máximo real de los datos
  // en vez de un rango fijo $5.000–$40.000 (las ventas del local suelen ser
  // mucho más chicas y muchos días son $0, con escala fija se veían planas).
  const maxVentaDiaGrafico = Math.max(...localData.ventasDiarias.map(d => d.ventas || 0), 1000);

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        bgcolor: 'background.default'
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <LinearProgress sx={{ width: 200, mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.primary' }}>
            Cargando datos del local...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <>
      {/* Header fijo mejorado */}
      <Box sx={{ 
        position: 'fixed',
        top: 0,
        left: { xs: 0, md: '240px' },
        right: 0,
        zIndex: 1000,
        bgcolor: 'background.default',
        padding: { xs: 2, md: 4 },
        borderBottom: `1px solid ${theme.palette.divider}`,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        backdropFilter: 'blur(20px)',
        height: 'auto',
        transition: 'all 0.3s ease'
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2
        }}>
          <Box>
            <Typography variant="h3" sx={{ 
              fontWeight: 800, 
              color: 'text.primary',
              marginBottom: 0.5,
              fontSize: { xs: '1.75rem', md: '2.5rem' },
              lineHeight: 1.2,
              letterSpacing: '-0.02em'
            }}>
              Dashboard Local Aguas Ancud
            </Typography>
            <Typography variant="body1" sx={{ 
              color: 'text.secondary',
              fontSize: '1rem',
              fontWeight: 400,
              lineHeight: 1.5
            }}>
              Panel de control y métricas del local en tiempo real
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Contenedor principal mejorado */}
      <Box sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        // paddingLeft/Right/Bottom por separado (no el shorthand "padding"): mezclar
        // "padding" con "paddingTop" hacía que la media query del shorthand
        // sobreescribiera paddingTop en desktop, dejando el header fijo tapando
        // la primera fila de tarjetas.
        paddingLeft: { xs: 2, md: 4 },
        paddingRight: { xs: 2, md: 4 },
        paddingBottom: { xs: 2, md: 4 },
        paddingTop: '160px', // Espacio para el header fijo (ahora más bajo sin el bloque de contacto)
        position: 'relative',
        overflow: 'auto',
        height: '100vh',
        background: theme.palette.mode === 'dark' 
          ? 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)'
          : 'linear-gradient(135deg, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.005) 100%)'
      }}>
        {/* Contenido principal */}
        <Box sx={{ 
          position: 'relative',
          minHeight: 'calc(100vh - 160px)',
          width: '100%',
          paddingBottom: '200px',
          maxWidth: '100%',
          margin: '0 auto'
        }}>

      {/* Dashboard Local - Mismo estilo que Home */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Primera fila - Ventas principales del LOCAL */}
        <Grid item xs={12} sm={6} md={3}>
          <VentasDiariasLocalCard
            title="VENTAS DIARIAS"
            subtitle="Hoy vs Mismo día mes anterior"
            ventasDiarias={localData.ventasHoy}
            ventasDiaAnterior={localData.ventasHoyMesPasado}
            tendenciaReal={localData.tendenciaDiariaReal}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VentasSemanalesLocalCard
            title="VENTAS SEMANALES"
            subtitle="Esta semana"
            ventasSemanales={localData.ventasSemana}
            ventasSemanaAnterior={localData.ventasSemanaMesPasado}
            tendenciaReal={localData.tendenciaSemanalReal}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VentasMensualesLocalCard
            title="VENTAS MENSUALES"
            subtitle="Este mes"
            ventasMensuales={localData.ventasMes}
            ventasMesAnterior={localData.ventasMesPasado}
            tendenciaReal={localData.tendenciaMensualReal}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VentasTotalesLocalCard
            title="VENTAS TOTALES LOCALES"
            subtitle="Acumulado del local"
            ventasTotales={localData.ventasAnio}
            ventasAnioPasado={localData.ventasAnioPasado}
            tendenciaReal={localData.tendenciaMensualReal}
          />
        </Grid>

        {/* Segunda fila - Métricas de productos y clientes */}
        <Grid item xs={12} sm={6} md={3}>
          <Box
            sx={{
              background: theme.palette.mode === 'dark' 
                ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
                : 'linear-gradient(135deg, #f8f9ff 0%, #e8eaff 100%)',
              borderRadius: 3,
              padding: 3,
              color: theme.palette.text.primary,
              boxShadow: theme.palette.mode === 'dark' 
                ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                : '0 4px 20px rgba(0, 0, 0, 0.08)',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              minHeight: 180,
              border: `1px solid ${theme.palette.mode === 'dark' 
                ? 'rgba(147, 112, 219, 0.2)' 
                : 'rgba(147, 112, 219, 0.1)'}`,
              position: 'relative',
              overflow: 'hidden',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: theme.palette.mode === 'dark' 
                  ? '0 8px 30px rgba(0, 0, 0, 0.4)'
                  : '0 8px 30px rgba(0, 0, 0, 0.12)'
              }
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    fontWeight: 700, 
                    color: theme.palette.text.primary, 
                    mb: 1.5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontSize: '1rem',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility',
                    fontFeatureSettings: '"liga" 1, "kern" 1',
                    fontDisplay: 'swap'
                  }}
                >
                  BIDONES VENDIDOS
                </Typography>
                <Typography 
                  variant="h3" 
                  sx={{ 
                    fontWeight: 800, 
                    mb: 1,
                    color: theme.palette.text.primary,
                    lineHeight: 1.1,
                    fontSize: '2.5rem',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility',
                    fontFeatureSettings: '"liga" 1, "kern" 1, "tnum" 1',
                    fontDisplay: 'swap'
                  }}
                >
                  {localData.bidonesVendidosMes}
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.8)' : theme.palette.text.secondary,
                    fontWeight: 500,
                    fontSize: '0.9rem',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility',
                    fontFeatureSettings: '"liga" 1, "kern" 1',
                    fontDisplay: 'swap'
                  }}
                >
                  Este mes
                </Typography>
              </Box>
              <Tooltip 
                title={`Bidones vendidos este mes: ${localData.bidonesVendidosMes}`}
                placement="top"
                arrow
              >
                <Chip
                  label={`${calcularPorcentajeCambio(localData.bidonesVendidosMes, localData.bidonesVendidosMesPasado) >= 0 ? '+' : ''}${calcularPorcentajeCambio(localData.bidonesVendidosMes, localData.bidonesVendidosMesPasado).toFixed(1)}%`}
                  sx={{
                    background: theme.palette.mode === 'dark' 
                      ? 'rgba(147, 112, 219, 0.2)' 
                      : 'rgba(147, 112, 219, 0.1)',
                    color: calcularPorcentajeCambio(localData.bidonesVendidosMes, localData.bidonesVendidosMesPasado) >= 0 ? '#059669' : '#dc2626',
                    fontWeight: 600,
                    border: `1px solid ${calcularPorcentajeCambio(localData.bidonesVendidosMes, localData.bidonesVendidosMesPasado) >= 0 ? 'rgba(5, 150, 105, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
                    fontSize: '0.9rem',
                    height: 'auto',
                    cursor: 'help',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility',
                    fontFeatureSettings: '"liga" 1, "kern" 1',
                    fontDisplay: 'swap',
                    '& .MuiChip-label': {
                      padding: '8px 12px',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }
                  }}
                />
              </Tooltip>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TicketPromedioCard 
            title="TICKET PROMEDIO"
            value={localData.ticketPromedio}
            subtitle="Por pedido"
            percentageChange={calcularPorcentajeCambio(localData.ticketPromedio, localData.ticketPromedioMesPasado)}
            isPositive={calcularPorcentajeCambio(localData.ticketPromedio, localData.ticketPromedioMesPasado) >= 0}
          />
        </Grid>


        <Grid item xs={12} sm={6} md={3}>
          <MetodosPagoLocalCard
            title="MÉTODOS DE PAGO"
            subtitle="Distribución de pagos por método en el local"
            metodosPago={localData.metodosPago || {}}
            totalTransacciones={localData.totalTransacciones}
          />
        </Grid>

        {/* Tercera fila - Meta de Ventas Local */}
        <Grid item xs={12} sm={6} md={6}>
          <KpiMetaCard
            title="META DE VENTAS LOCAL"
            currentValue={localData.ventasMes}
            // Meta dinámica: ventas del mes anterior + 10% (mismo criterio que la
            // meta del Home), no un número fijo inventado.
            targetValue={Math.round((localData.ventasMesPasado || 0) * 1.1)}
            percentage={localData.ventasMesPasado > 0
              ? Math.min(100, Math.round((localData.ventasMes / (localData.ventasMesPasado * 1.1)) * 100))
              : 0}
            subtitle="Objetivo Mensual"
          />
        </Grid>
      </Grid>

      {/* Gráfico de Barras - Ventas Diarias */}
      <Card sx={{ 
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.shadows[1],
        mb: 4,
        transition: 'all 0.3s ease-in-out',
        '&:hover': {
          boxShadow: theme.shadows[4],
        }
      }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 700, 
            color: theme.palette.text.primary,
            mb: 3,
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            📊 Ventas Diarias - Últimos 7 Días
          </Typography>
          
          <Box sx={{ 
            width: '100%', 
            height: 400,
            position: 'relative',
            mt: 2,
            display: 'flex',
            flexDirection: 'column'
          }}>
            {localData.ventasDiarias && localData.ventasDiarias.length > 0 ? (
              <>
                {console.log('Datos del gráfico:', localData.ventasDiarias)}
                {console.log('Número de días:', localData.ventasDiarias.length)}
                {console.log('Ventas por día:', localData.ventasDiarias.map(d => `${d.dia}: $${d.ventas}`))}
                <svg 
                  width="100%" 
                  height="100%" 
                  viewBox="0 0 900 500" 
                  style={{ overflow: 'visible' }}
                  preserveAspectRatio="xMidYMid meet"
                >
              {/* Definir gradiente para las barras */}
              <defs>
                <linearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#9370db" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.6"/>
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge> 
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              
              {/* Ejes */}
              <line 
                x1="120" y1="420" x2="820" y2="420" 
                stroke={theme.palette.mode === 'dark' ? '#4b5563' : '#d1d5db'} 
                strokeWidth="3"
              />
              <line 
                x1="120" y1="60" x2="120" y2="420" 
                stroke={theme.palette.mode === 'dark' ? '#4b5563' : '#d1d5db'} 
                strokeWidth="3"
              />
              
              {/* Barras del gráfico */}
              {localData.ventasDiarias.map((dia, index) => {
                // Escala dinámica: 0 hasta el máximo real de ventas de la semana
                const maxHeight = 320; // Altura máxima en píxeles (mucho más grande)
                const barHeight = dia.ventas > 0 ? Math.max((dia.ventas / maxVentaDiaGrafico) * maxHeight, 12) : 0;
                const barWidth = 100; // Ancho de barra (más ancho)
                const availableWidth = 700; // Ancho disponible (820 - 120)
                const totalBars = localData.ventasDiarias.length;
                const barSpacing = (availableWidth - (totalBars * barWidth)) / (totalBars + 1);
                const barX = 120 + barSpacing + (index * (barWidth + barSpacing));
                const barY = 420 - barHeight;
                
                return (
                  <g key={index}>
                    {/* Barra con glow effect */}
                    <rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      fill="url(#barGradient)"
                      filter="url(#glow)"
                      rx="4"
                      ry="4"
                      opacity="0.9"
                    />
                    
                    {/* Valor de ventas sobre la barra */}
                    <text
                      x={barX + barWidth / 2}
                      y={barY - 25}
                      textAnchor="middle"
                      fill={theme.palette.text.primary}
                      fontSize="20"
                      fontWeight="600"
                      fontFamily='"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
                    >
                      {dia.ventas > 0 ? `$${dia.ventas.toLocaleString()}` : '$0'}
                    </text>
                    
                    {/* Día de la semana */}
                    <text
                      x={barX + barWidth / 2}
                      y="460"
                      textAnchor="middle"
                      fill={theme.palette.text.secondary}
                      fontSize="22"
                      fontWeight="500"
                      fontFamily='"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
                    >
                      {dia.dia}
                    </text>
                    
                    {/* Tooltip interactivo */}
                    <rect
                      x={barX - 15}
                      y={barY - 15}
                      width={barWidth + 30}
                      height={barHeight + 30}
                      fill="transparent"
                      cursor="pointer"
                      onMouseEnter={(e) => {
                        e.target.style.opacity = '0.1';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.opacity = '0';
                      }}
                    />
                  </g>
                );
              })}
              
              {/* Líneas de referencia horizontales con montos */}
              {(() => {
                // 5 líneas de referencia repartidas entre 0 y el máximo real de la semana
                const pasos = 5;
                const montos = Array.from({ length: pasos }, (_, i) =>
                  Math.round((maxVentaDiaGrafico / pasos) * (i + 1))
                );

                return montos.map((monto, index) => {
                  const maxHeight = 320; // Altura máxima en píxeles (mucho más grande)
                  const y = 420 - (monto / maxVentaDiaGrafico) * maxHeight;
                  return (
                    <g key={index}>
                      <line 
                        x1="115" y1={y} x2="825" y2={y} 
                        stroke={theme.palette.mode === 'dark' ? '#374151' : '#e5e7eb'} 
                        strokeWidth="2"
                        strokeDasharray="5,5"
                      />
                      <text
                        x="110"
                        y={y + 6}
                        textAnchor="end"
                        fill={theme.palette.text.secondary}
                        fontSize="16"
                        fontFamily='"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
                      >
                        ${monto.toLocaleString()}
                      </text>
                    </g>
                  );
                });
              })()}
                           </svg>
               </>
             ) : (
               <Box sx={{ 
                 display: 'flex', 
                 justifyContent: 'center', 
                 alignItems: 'center', 
                 height: '100%',
                 color: theme.palette.text.secondary
               }}>
                 <Typography variant="body1">
                   Cargando datos de ventas diarias...
                 </Typography>
               </Box>
             )}
           </Box>
          
          {/* Leyenda */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            mt: 2,
            gap: 3
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ 
                width: 16, 
                height: 16, 
                background: 'url(#barGradient)', 
                borderRadius: 2 
              }} />
              <Typography variant="body2" sx={{ 
                color: theme.palette.text.secondary,
                fontSize: '0.875rem',
                fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
              }}>
                Ventas Diarias
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

        </Box>
      </Box>
    </>
  );
} 