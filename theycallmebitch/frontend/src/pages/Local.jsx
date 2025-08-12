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
  Store,
  AttachMoney,
  ShoppingCart,
  People,
  Inventory,
  Schedule,
  LocationOn,
  Phone,
  Email,
  Info
} from '@mui/icons-material';
// Importar los mismos componentes del dashboard principal
import VentasCard from '../components/VentasCard';
import VentasMensualesCard from '../components/VentasMensualesCard';
import VentasSemanalesCard from '../components/VentasSemanalesCard';
import VentasDiariasCard from '../components/VentasDiariasCard';
import BidonesCard from '../components/BidonesCard';
import TicketPromedioCard from '../components/TicketPromedioCard';
import ClientesActivosCard from '../components/ClientesActivosCard';
import KpiMetaCard from '../components/KpiMetaCard';
import CapacidadCard from '../components/CapacidadCard';
import './Local.css';

export default function Local() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [localData, setLocalData] = useState({
    // Información del local
    nombre: "Aguas Ancud - Local Principal",
    direccion: "Av. Libertad 123, Ancud",
    telefono: "+56 9 1234 5678",
    email: "ventas@aguasancud.cl",
    horario: "Lunes a Sábado: 8:00 - 20:00",
    
    // Datos de venta del local
    ventasHoy: 125000,
    ventasSemana: 875000,
    ventasMes: 3200000,
    ventasAnio: 38500000,
    
    // Datos de comparación del mes anterior
    ventasHoyMesPasado: 98000,
    ventasSemanaMesPasado: 720000,
    ventasMesPasado: 2850000,
    ventasAnioPasado: 34500000,
    
    // Métricas de clientes
    clientesHoy: 15,
    clientesSemana: 98,
    clientesMes: 420,
    clientesAnio: 4850,
    clientesMesPasado: 380,
    
    // Métricas de productos
    bidonesVendidosHoy: 25,
    bidonesVendidosSemana: 175,
    bidonesVendidosMes: 640,
    bidonesVendidosAnio: 7700,
    bidonesVendidosMesPasado: 580,
    
    // Métricas de eficiencia
    ticketPromedio: 8300,
    ticketPromedioMesPasado: 7800,
    eficienciaVentas: 94.5,
    satisfaccionClientes: 4.8,
    tiempoAtencion: 3.2,
    
    // Historial de ventas por día (últimos 7 días)
    ventasDiarias: [
      { dia: 'Lunes', ventas: 180000, clientes: 22, bidones: 36 },
      { dia: 'Martes', ventas: 165000, clientes: 20, bidones: 33 },
      { dia: 'Miércoles', ventas: 195000, clientes: 24, bidones: 39 },
      { dia: 'Jueves', ventas: 210000, clientes: 26, bidones: 42 },
      { dia: 'Viernes', ventas: 235000, clientes: 28, bidones: 47 },
      { dia: 'Sábado', ventas: 185000, clientes: 23, bidones: 37 },
      { dia: 'Domingo', ventas: 0, clientes: 0, bidones: 0 }
    ],
    
    // Productos más vendidos
    productosTop: [
      { nombre: 'Bidón 20L Agua Purificada', cantidad: 640, precio: 2000, total: 1280000 },
      { nombre: 'Bidón 5L Agua Purificada', cantidad: 320, precio: 800, total: 256000 },
      { nombre: 'Garrafa 10L Agua Mineral', cantidad: 180, precio: 1500, total: 270000 },
      { nombre: 'Botella 1L Agua con Gas', cantidad: 450, precio: 500, total: 225000 },
      { nombre: 'Filtro de Agua Doméstico', cantidad: 25, precio: 15000, total: 375000 }
    ],
    
    // Métodos de pago utilizados
    metodosPago: [
      { metodo: 'Efectivo', cantidad: 65, porcentaje: 65 },
      { metodo: 'Transferencia', cantidad: 25, porcentaje: 25 },
      { metodo: 'Tarjeta Débito', cantidad: 8, porcentaje: 8 },
      { metodo: 'Tarjeta Crédito', cantidad: 2, porcentaje: 2 }
    ],
    
    // Personal del local
    personal: [
      { nombre: 'María González', cargo: 'Vendedora Principal', horario: '8:00 - 16:00', ventas: 1250000 },
      { nombre: 'Carlos Silva', cargo: 'Vendedor', horario: '12:00 - 20:00', ventas: 980000 },
      { nombre: 'Ana Rodríguez', cargo: 'Auxiliar', horario: '8:00 - 14:00', ventas: 650000 }
    ]
  });

  useEffect(() => {
    // Cargar datos reales del local
      setLoading(false);
    
    // Actualización automática cada 10 minutos
    const interval = setInterval(() => {
      console.log('Actualización automática del local...');
      // Aquí se cargarían los datos reales del JSON
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }, 10 * 60 * 1000); // 10 minutos

    // Escuchar evento de actualización global
    const handleGlobalRefresh = () => {
      console.log('Actualización global detectada en Local...');
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 500);
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
    <Box sx={{ 
      maxWidth: 1400, 
      mx: 'auto', 
      p: 3,
      minHeight: '100vh',
      bgcolor: 'background.default'
    }}>
      {/* Header Principal */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{
          fontWeight: 700,
          color: 'text.primary',
          mb: 1,
          fontSize: '2.5rem',
          fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
          fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
        }}>
          Dashboard Local Aguas Ancud
        </Typography>
        <Typography variant="body1" sx={{
          color: 'text.secondary',
          fontSize: '1.1rem',
          fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
        }}>
          Panel de control y métricas del local en tiempo real
        </Typography>
      </Box>

      {/* Header del Local */}
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
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Store sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
            <Box>
              <Typography variant="h4" sx={{ 
                fontWeight: 700, 
                color: theme.palette.text.primary,
                fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
                textRendering: 'optimizeLegibility'
              }}>
                {localData.nombre}
              </Typography>
              <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
                Gestión y administración del local físico
              </Typography>
            </Box>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LocationOn sx={{ color: 'primary.main', mr: 1 }} />
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  {localData.direccion}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Phone sx={{ color: 'primary.main', mr: 1 }} />
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  {localData.telefono}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Email sx={{ color: 'primary.main', mr: 1 }} />
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  {localData.email}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Schedule sx={{ color: 'primary.main', mr: 1 }} />
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  {localData.horario}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Dashboard Local - Mismo estilo que Home */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Primera fila - Ventas principales */}
        <Grid item xs={12} sm={6} md={3}>
          <VentasDiariasCard 
            title="VENTAS DIARIAS"
            value={localData.ventasHoy}
            subtitle="Hoy vs Mismo día mes anterior"
            percentageChange={calcularPorcentajeCambio(localData.ventasHoy, localData.ventasHoyMesPasado)}
            isPositive={calcularPorcentajeCambio(localData.ventasHoy, localData.ventasHoyMesPasado) >= 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VentasSemanalesCard 
            title="VENTAS SEMANALES"
            value={localData.ventasSemana}
            subtitle="Esta semana"
            percentageChange={calcularPorcentajeCambio(localData.ventasSemana, localData.ventasSemanaMesPasado)}
            isPositive={calcularPorcentajeCambio(localData.ventasSemana, localData.ventasSemanaMesPasado) >= 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VentasMensualesCard 
            title="VENTAS MENSUALES"
            value={localData.ventasMes}
            subtitle="Este mes"
            percentageChange={calcularPorcentajeCambio(localData.ventasMes, localData.ventasMesPasado)}
            isPositive={calcularPorcentajeCambio(localData.ventasMes, localData.ventasMesPasado) >= 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <VentasCard 
            title="VENTAS TOTALES LOCALES"
            value={localData.ventasAnio}
            subtitle="Acumulado del local"
            percentageChange={calcularPorcentajeCambio(localData.ventasAnio, localData.ventasAnioPasado)}
            isPositive={calcularPorcentajeCambio(localData.ventasAnio, localData.ventasAnioPasado) >= 0}
          />
        </Grid>

        {/* Segunda fila - Métricas de productos y clientes */}
        <Grid item xs={12} sm={6} md={3}>
          <BidonesCard 
            title="BIDONES VENDIDOS"
            value={localData.bidonesVendidosMes}
            subtitle="Este mes"
            percentageChange={calcularPorcentajeCambio(localData.bidonesVendidosMes, localData.bidonesVendidosMesPasado)}
            isPositive={calcularPorcentajeCambio(localData.bidonesVendidosMes, localData.bidonesVendidosMesPasado) >= 0}
          />
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
          <ClientesActivosCard 
            title="CLIENTES ACTIVOS"
            value={localData.clientesMes}
            subtitle="Este mes"
            percentageChange={calcularPorcentajeCambio(localData.clientesMes, localData.clientesMesPasado)}
            isPositive={calcularPorcentajeCambio(localData.clientesMes, localData.clientesMesPasado) >= 0}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            bgcolor: 'background.paper',
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[1],
            height: '100%',
            transition: 'all 0.3s ease-in-out',
            '&:hover': {
              boxShadow: theme.shadows[4],
            }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h4" sx={{ 
                fontWeight: 700, 
                color: theme.palette.text.primary,
                fontSize: '2rem',
                mb: 1
              }}>
                {localData.clientesHoy}
              </Typography>
              <Typography variant="body1" sx={{ 
                color: theme.palette.text.secondary,
                fontWeight: 600,
                mb: 1
              }}>
                CLIENTES HOY
              </Typography>
              <Typography variant="body2" sx={{ 
                color: theme.palette.text.secondary
              }}>
                Clientes atendidos hoy
              </Typography>
              <Chip
                label="+20%"
                size="small"
                sx={{
                  mt: 1,
                  bgcolor: theme.palette.success.light,
                  color: theme.palette.success.dark,
                  fontWeight: 600,
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Tercera fila - Métricas especiales */}
        <Grid item xs={12} sm={6} md={6}>
          <KpiMetaCard 
            title="META DE VENTAS LOCAL"
            currentValue={localData.ventasMes}
            targetValue={localData.ventasMes * 1.2} // Meta 20% superior
            percentage={Math.round((localData.ventasMes / (localData.ventasMes * 1.2)) * 100)}
            subtitle="Objetivo Mensual"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={6}>
          <CapacidadCard 
            title="CAPACIDAD DEL LOCAL"
            currentValue={75} // Capacidad actual del local
            maxValue={100}
            percentage={75}
            subtitle="Capacidad de atención"
          />
        </Grid>
      </Grid>

      {/* Gráfico de Ventas Diarias */}
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
            📈 Ventas de la Semana
          </Typography>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? '#374151' : '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Día</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Ventas</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Clientes</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Bidones</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Promedio</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {localData.ventasDiarias.map((dia, index) => (
                  <TableRow key={index} sx={{ 
                    '&:hover': { bgcolor: theme.palette.mode === 'dark' ? '#374151' : '#f8fafc' }
                  }}>
                    <TableCell sx={{ 
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      {dia.dia}
                    </TableCell>
                    <TableCell sx={{ 
                      color: theme.palette.text.primary,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      ${dia.ventas.toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ 
                      color: theme.palette.text.primary,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      {dia.clientes}
                    </TableCell>
                    <TableCell sx={{ 
                      color: theme.palette.text.primary,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      {dia.bidones}
                    </TableCell>
                    <TableCell sx={{ 
                      color: theme.palette.text.primary,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      ${dia.clientes > 0 ? Math.round(dia.ventas / dia.clientes).toLocaleString() : 0}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Productos Más Vendidos */}
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
            🏆 Productos Más Vendidos
          </Typography>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: theme.palette.mode === 'dark' ? '#374151' : '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Producto</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Cantidad</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Precio Unit.</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Total</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>% del Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {localData.productosTop.map((producto, index) => (
                  <TableRow key={index} sx={{ 
                    '&:hover': { bgcolor: theme.palette.mode === 'dark' ? '#374151' : '#f8fafc' }
                  }}>
                    <TableCell sx={{ 
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      {producto.nombre}
                    </TableCell>
                    <TableCell sx={{ 
                      color: theme.palette.text.primary,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      {producto.cantidad}
                    </TableCell>
                    <TableCell sx={{ 
                      color: theme.palette.text.primary,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      ${producto.precio.toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ 
                      color: theme.palette.text.primary,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      ${producto.total.toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ 
                      color: theme.palette.text.primary,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      {((producto.total / localData.ventasMes) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Métodos de Pago y Personal */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            bgcolor: 'background.paper',
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[1],
            height: '100%',
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
                💳 Métodos de Pago
              </Typography>
              
              {localData.metodosPago.map((metodo, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ 
                      color: theme.palette.text.primary,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      {metodo.metodo}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: theme.palette.text.secondary,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      {metodo.porcentaje}%
                    </Typography>
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={metodo.porcentaje} 
                    sx={{ 
                      height: 8, 
                      borderRadius: 4,
                      bgcolor: theme.palette.mode === 'dark' ? '#374151' : '#e2e8f0',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4
                      }
                    }} 
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            bgcolor: 'background.paper',
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[1],
            height: '100%',
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
                👥 Personal del Local
              </Typography>
              
              {localData.personal.map((persona, index) => (
                <Box key={index} sx={{ mb: 3, p: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderRadius: 2 }}>
                  <Typography variant="subtitle1" sx={{ 
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    mb: 1,
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>
                    {persona.nombre}
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    color: theme.palette.text.secondary,
                    mb: 1,
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>
                    {persona.cargo} • {persona.horario}
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    color: 'primary.main',
                    fontWeight: 600,
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>
                    Ventas: ${persona.ventas.toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
} 