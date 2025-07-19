import React, { useState, useEffect } from 'react';
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
  LinearProgress
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
import { useTheme } from '@mui/material/styles';
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
    
    // Métricas de clientes
    clientesHoy: 15,
    clientesSemana: 98,
    clientesMes: 420,
    clientesAnio: 4850,
    
    // Métricas de productos
    bidonesVendidosHoy: 25,
    bidonesVendidosSemana: 175,
    bidonesVendidosMes: 640,
    bidonesVendidosAnio: 7700,
    
    // Métricas de eficiencia
    ticketPromedio: 8300,
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

  // Componente KPI Card
  const KpiCard = ({ title, value, subtitle, icon, trend, isPositive, color = '#3b82f6' }) => (
    <Card sx={{ 
      bgcolor: theme.palette.mode === 'dark' ? '#1a1a2e' : '#fff',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      borderRadius: 3,
      border: `1px solid ${theme.palette.divider}`,
      height: '100%',
      transition: 'all 0.3s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 8px 25px rgba(0,0,0,0.12)'
      }
    }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ 
            width: 48, 
            height: 48, 
            borderRadius: 2, 
            bgcolor: color, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'white'
          }}>
            {icon}
          </Box>
          <Chip 
            label={trend} 
            size="small"
            sx={{ 
              bgcolor: isPositive ? '#dcfce7' : '#fee2e2',
              color: isPositive ? '#166534' : '#dc2626',
              fontWeight: 600
            }}
          />
        </Box>
        
        <Typography variant="h4" sx={{ 
          fontWeight: 700, 
          color: theme.palette.text.primary,
          mb: 1,
          fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility'
        }}>
          {typeof value === 'number' ? value.toLocaleString('es-CL') : value}
        </Typography>
        
        <Typography variant="body1" sx={{ 
          color: theme.palette.text.secondary, 
          fontWeight: 600,
          mb: 1,
          fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility'
        }}>
          {title}
        </Typography>
        
        <Typography variant="body2" sx={{ 
          color: theme.palette.text.secondary,
          fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility'
        }}>
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );

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
      overflow: 'auto',
      height: '100vh'
    }}>
      {/* Header del Local */}
      <Card sx={{ 
        bgcolor: theme.palette.mode === 'dark' ? '#1a1a2e' : '#fff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        borderRadius: 3,
        border: `1px solid ${theme.palette.divider}`,
        mb: 4
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

      {/* KPI Cards - Ventas */}
      <Typography variant="h5" sx={{ 
        fontWeight: 700, 
        color: theme.palette.text.primary,
        mb: 3,
        fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}>
        📊 Métricas de Ventas
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Ventas Hoy"
            value={localData.ventasHoy}
            subtitle="Ingresos del día actual"
            icon={<AttachMoney />}
            trend="+12.5%"
            isPositive={true}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Ventas Semana"
            value={localData.ventasSemana}
            subtitle="Ingresos de esta semana"
            icon={<TrendingUp />}
            trend="+8.3%"
            isPositive={true}
            color="#3b82f6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Ventas Mes"
            value={localData.ventasMes}
            subtitle="Ingresos del mes actual"
            icon={<TrendingUp />}
            trend="+15.2%"
            isPositive={true}
            color="#f59e0b"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Ventas Año"
            value={localData.ventasAnio}
            subtitle="Ingresos del año actual"
            icon={<TrendingUp />}
            trend="+22.1%"
            isPositive={true}
            color="#8b5cf6"
          />
        </Grid>
      </Grid>

      {/* KPI Cards - Clientes y Productos */}
      <Typography variant="h5" sx={{ 
        fontWeight: 700, 
        color: theme.palette.text.primary,
        mb: 3,
        fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}>
        👥 Clientes y Productos
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Clientes Hoy"
            value={localData.clientesHoy}
            subtitle="Clientes atendidos hoy"
            icon={<People />}
            trend="+20%"
            isPositive={true}
            color="#10b981"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Bidones Vendidos"
            value={localData.bidonesVendidosHoy}
            subtitle="Bidones vendidos hoy"
            icon={<Inventory />}
            trend="+15%"
            isPositive={true}
            color="#3b82f6"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Ticket Promedio"
            value={`$${localData.ticketPromedio.toLocaleString()}`}
            subtitle="Valor promedio por venta"
            icon={<ShoppingCart />}
            trend="+5.2%"
            isPositive={true}
            color="#f59e0b"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KpiCard
            title="Eficiencia Ventas"
            value={`${localData.eficienciaVentas}%`}
            subtitle="Eficiencia en ventas"
            icon={<TrendingUp />}
            trend="+2.1%"
            isPositive={true}
            color="#8b5cf6"
          />
        </Grid>
      </Grid>

      {/* Gráfico de Ventas Diarias */}
      <Card sx={{ 
        bgcolor: theme.palette.mode === 'dark' ? '#1a1a2e' : '#fff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        borderRadius: 3,
        border: `1px solid ${theme.palette.divider}`,
        mb: 4
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
        bgcolor: theme.palette.mode === 'dark' ? '#1a1a2e' : '#fff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        borderRadius: 3,
        border: `1px solid ${theme.palette.divider}`,
        mb: 4
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
            bgcolor: theme.palette.mode === 'dark' ? '#1a1a2e' : '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            height: '100%'
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
            bgcolor: theme.palette.mode === 'dark' ? '#1a1a2e' : '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            borderRadius: 3,
            border: `1px solid ${theme.palette.divider}`,
            height: '100%'
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
                <Box key={index} sx={{ mb: 3, p: 2, bgcolor: theme.palette.mode === 'dark' ? '#374151' : '#f8fafc', borderRadius: 2 }}>
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