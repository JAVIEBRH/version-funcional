import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, InputAdornment, Chip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { getPedidos } from '../services/api';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Tooltip from '@mui/material/Tooltip';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InventoryIcon from '@mui/icons-material/Inventory';

export default function Pedidos({ refreshTrigger = 0 }) {
  const [pedidos, setPedidos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // Fecha actual por defecto
  const [pagina, setPagina] = useState(1);
  const pedidosPorPagina = 10;

  const cargarPedidos = async () => {
    try {
      const data = await getPedidos();
      // Ordenar del más reciente al más antiguo
      const pedidosOrdenados = [...data].sort((a, b) => {
        const fa = parseFecha(a.fecha);
        const fb = parseFecha(b.fecha);
        return fb - fa;
      });
      setPedidos(pedidosOrdenados);
      console.log('Pedidos actualizados:', new Date().toLocaleTimeString());
      

      
      } catch (error) {
        setPedidos([]);
    }
  };

  useEffect(() => {
    cargarPedidos();
    
    // Actualización automática cada 10 minutos
    const interval = setInterval(() => {
      console.log('Actualización automática de pedidos...');
      cargarPedidos();
    }, 10 * 60 * 1000); // 10 minutos

    // Escuchar evento de actualización global
    const handleGlobalRefresh = () => {
      console.log('Actualización global detectada en Pedidos...');
      cargarPedidos();
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('globalRefresh', handleGlobalRefresh);
    };
  }, [refreshTrigger]);

  // Definir fecha seleccionada al principio
  const fechaSeleccionada = selectedDate; // Formato YYYY-MM-DD

  // Filtro de búsqueda que incluye fecha seleccionada
  const filteredPedidos = pedidos.filter(p => {
    // Primero filtrar por fecha seleccionada
    const fechaPedido = parseFecha(p.fecha);
    if (!fechaPedido) return false;
    const fechaPedidoStr = fechaPedido.toISOString().split('T')[0];
    if (fechaPedidoStr !== fechaSeleccionada) return false;
    
    // Luego aplicar filtro de búsqueda
    const texto = `${p.fecha || ''} ${p.dire || ''} ${p.usuario || ''} ${p.precio || ''} ${p.status || ''}`.toLowerCase();
    return texto.includes(searchTerm.toLowerCase());
  });

  // Paginación
  const totalPaginas = Math.ceil(filteredPedidos.length / pedidosPorPagina);
  const pedidosPagina = filteredPedidos.slice((pagina - 1) * pedidosPorPagina, pagina * pedidosPorPagina);
  useEffect(() => { setPagina(1); }, [searchTerm]);

  // Función para parsear fechas DD-MM-YYYY a Date
  function parseFecha(fechaStr) {
    if (!fechaStr) return null;
    if (/\d{4}-\d{2}-\d{2}/.test(fechaStr)) return new Date(fechaStr);
    const match = fechaStr.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (match) {
      const [_, d, m, y] = match;
      return new Date(`${y}-${m}-${d}`);
    }
    return null;
  }

  // Función para determinar el estilo del estado del pedido
  const getEstadoStyle = (status) => {
    const statusLower = (status || '').toLowerCase().trim();
    
    if (statusLower.includes('entregado') || statusLower.includes('completado') || statusLower.includes('finalizado')) {
      return {
        bgcolor: '#dcfce7',
        color: '#166534',
        label: 'Entregado'
      };
    } else if (statusLower.includes('preparando') || statusLower.includes('en proceso') || statusLower.includes('procesando')) {
      return {
        bgcolor: '#fef3c7',
        color: '#92400e',
        label: 'Preparando'
      };
    } else if (statusLower.includes('cancelado') || statusLower.includes('cancelada') || statusLower.includes('anulado')) {
      return {
        bgcolor: '#fee2e2',
        color: '#dc2626',
        label: 'Cancelado'
      };
    } else {
      // Estado por defecto para estados no reconocidos
      return {
        bgcolor: '#f1f5f9',
        color: '#64748b',
        label: status || 'Pendiente'
      };
    }
  };

  // Filtrar pedidos por fecha seleccionada
  const pedidosFechaSeleccionadaCompletos = pedidos.filter(p => {
    const fechaPedido = parseFecha(p.fecha);
    if (!fechaPedido) return false;
    const fechaPedidoStr = fechaPedido.toISOString().split('T')[0];
    return fechaPedidoStr === fechaSeleccionada;
  });

  // Cards de resumen sobre los pedidos de la fecha seleccionada
  const ventasTotales = pedidosFechaSeleccionadaCompletos.reduce((sum, p) => sum + (Number(p.precio) || 0), 0);
  const countEfectivo = pedidosFechaSeleccionadaCompletos.filter(p => (p.metodopago || '').toLowerCase().includes('efectivo')).length;
  const countTransferencia = pedidosFechaSeleccionadaCompletos.filter(p => (p.metodopago || '').toLowerCase().includes('transfer')).length;
  const countTarjeta = pedidosFechaSeleccionadaCompletos.filter(p => (p.metodopago || '').toLowerCase().includes('tarjeta')).length;
  
  // Nuevos cálculos para pedidos del día seleccionado y bidones vendidos
  
  // Calcular pedidos y bidones de la FECHA SELECCIONADA usando TODOS los pedidos (no filtrados)
  const pedidosFechaSeleccionada = pedidos.filter(p => {
    const fechaPedido = parseFecha(p.fecha);
    if (!fechaPedido) return false;
    const fechaPedidoStr = fechaPedido.toISOString().split('T')[0];
    return fechaPedidoStr === fechaSeleccionada;
  }).length;
  
  // Calcular bidones vendidos en la fecha seleccionada usando TODOS los pedidos
  const pedidosFechaSeleccionadaData = pedidos.filter(p => {
    const fechaPedido = parseFecha(p.fecha);
    if (!fechaPedido) return false;
    const fechaPedidoStr = fechaPedido.toISOString().split('T')[0];
    return fechaPedidoStr === fechaSeleccionada;
  });
  
  const bidonesFechaSeleccionada = pedidosFechaSeleccionadaData.reduce((sum, p) => {
    let cantidad = 1;
    

    
    // Primero intentar obtener cantidad de campos específicos
    if (p.cantidad) cantidad = Number(p.cantidad);
    else if (p.cant) cantidad = Number(p.cant);
    else if (p.qty) cantidad = Number(p.qty);
    else if (p.quantity) cantidad = Number(p.quantity);
    else if (p.bidones) cantidad = Number(p.bidones);
    else if (p.unidades) cantidad = Number(p.unidades);
    else cantidad = NaN; // Si no hay ningún campo, forzar NaN
    
    // Si no hay campo de cantidad específica, calcular basándose en el precio
    if (isNaN(cantidad) || cantidad <= 0) {
      const precio = Number(p.precio) || 0;
      // Calcular bidones basándose en el precio real ($2,000 por bidón)
      if (precio > 0) {
        cantidad = Math.ceil(precio / 2000); // $2,000 por bidón
      }
    }
    
    return sum + cantidad; // Removido Math.max(1, cantidad) para usar el cálculo real
  }, 0);
  

  

  
  // Calcular bidones vendidos
  const bidonesVendidos = filteredPedidos.reduce((sum, p) => {
    // Intentar obtener cantidad de diferentes campos posibles
    let cantidad = 1; // Por defecto 1 bidón por pedido
    
    // Buscar en diferentes campos posibles
    if (p.cantidad) cantidad = Number(p.cantidad);
    else if (p.cant) cantidad = Number(p.cant);
    else if (p.qty) cantidad = Number(p.qty);
    else if (p.quantity) cantidad = Number(p.quantity);
    else if (p.bidones) cantidad = Number(p.bidones);
    else if (p.unidades) cantidad = Number(p.unidades);
    
    // Si no se pudo convertir a número, calcular basándose en el precio
    if (isNaN(cantidad) || cantidad <= 0) {
      const precio = Number(p.precio) || 0;
      if (precio > 0) {
        cantidad = Math.ceil(precio / 2000); // $2,000 por bidón
      }
    }
    
    return sum + cantidad; // Removido Math.max(1, cantidad) para usar el cálculo real
  }, 0);

  return (
    <Box sx={{ 
      maxWidth: 1400, 
      mx: 'auto', 
      p: 3,
      minHeight: '100vh',
      overflow: 'auto',
      height: '100vh'
    }}>
      <Card sx={{ bgcolor: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: 3, border: '1px solid #f1f5f9', mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
              Historial de Pedidos
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                size="small"
                sx={{ width: 200 }}
                InputProps={{
                  sx: { 
                    fontWeight: 600,
                    color: '#1e293b'
                  }
                }}
              />
            <TextField
              placeholder="Buscar en historial..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              size="small"
              sx={{ width: 300 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#1e293b' }} />
                  </InputAdornment>
                ),
              }}
            />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
            <Card sx={{ minWidth: 220, bgcolor: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: 3, border: '1px solid #f1f5f9' }}>
              <CardContent sx={{ p: 3 }}>
                <Tooltip title={`Suma total de ventas del ${new Date(selectedDate).toLocaleDateString('es-ES')}`} placement="top" arrow>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>${ventasTotales.toLocaleString()}</Typography>
                </Tooltip>
                <Typography variant="body1" sx={{ 
                  color: 'text.primary', 
                  fontWeight: 600,
                  fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeLegibility'
                }}>Ventas Totales</Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 180, bgcolor: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: 3, border: '1px solid #f1f5f9' }}>
              <CardContent sx={{ p: 3 }}>
                <Tooltip title={`Pedidos pagados en efectivo el ${new Date(selectedDate).toLocaleDateString('es-ES')}`} placement="top" arrow>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>{countEfectivo}</Typography>
                </Tooltip>
                <Typography variant="body1" sx={{ 
                  color: 'text.primary', 
                  fontWeight: 600,
                  fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeLegibility'
                }}>Efectivo</Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 180, bgcolor: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: 3, border: '1px solid #f1f5f9' }}>
              <CardContent sx={{ p: 3 }}>
                <Tooltip title={`Pedidos pagados por transferencia el ${new Date(selectedDate).toLocaleDateString('es-ES')}`} placement="top" arrow>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>{countTransferencia}</Typography>
                </Tooltip>
                <Typography variant="body1" sx={{ 
                  color: 'text.primary', 
                  fontWeight: 600,
                  fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeLegibility'
                }}>Transferencia</Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 180, bgcolor: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: 3, border: '1px solid #f1f5f9' }}>
              <CardContent sx={{ p: 3 }}>
                <Tooltip title={`Pedidos pagados con tarjeta el ${new Date(selectedDate).toLocaleDateString('es-ES')}`} placement="top" arrow>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>{countTarjeta}</Typography>
                </Tooltip>
                <Typography variant="body1" sx={{ 
                  color: 'text.primary', 
                  fontWeight: 600,
                  fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeLegibility'
                }}>Tarjeta</Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 180, bgcolor: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: 3, border: '1px solid #f1f5f9' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LocalShippingIcon sx={{ color: '#10b981', fontSize: 20 }} />
                  <Tooltip title={`${pedidosFechaSeleccionada} pedidos realizados el ${new Date(selectedDate).toLocaleDateString('es-ES')}`} placement="top" arrow>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#10b981', cursor: 'pointer' }}>{pedidosFechaSeleccionada}</Typography>
                  </Tooltip>
                </Box>
                <Typography variant="body1" sx={{ 
                  color: 'text.primary', 
                  fontWeight: 600,
                  fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeLegibility'
                }}>Pedidos {selectedDate === new Date().toISOString().split('T')[0] ? 'Hoy' : 'del Día'}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 180, bgcolor: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: 3, border: '1px solid #f1f5f9' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <InventoryIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
                  <Tooltip title={`${bidonesFechaSeleccionada} bidones vendidos el ${new Date(selectedDate).toLocaleDateString('es-ES')} | Total histórico: ${bidonesVendidos} bidones`} placement="top" arrow>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#f59e0b', cursor: 'pointer' }}>{bidonesFechaSeleccionada}</Typography>
                  </Tooltip>
                </Box>
                <Typography variant="body1" sx={{ 
                  color: 'text.primary', 
                  fontWeight: 600,
                  fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeLegibility'
                }}>Bidones {selectedDate === new Date().toISOString().split('T')[0] ? 'Hoy' : 'del Día'}</Typography>
              </CardContent>
            </Card>
          </Box>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Cliente</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Dirección</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Fecha</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Monto</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Método de Pago</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.primary' }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pedidosPagina.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: '#3b82f6' }}>{(p.usuario || '?').charAt(0)}</Avatar>
                        <Box>
                          <Typography variant="body1" sx={{ 
                            fontWeight: 600, 
                            color: 'text.primary',
                            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                            WebkitFontSmoothing: 'antialiased',
                            MozOsxFontSmoothing: 'grayscale',
                            textRendering: 'optimizeLegibility'
                          }}>{p.usuario || '-'}</Typography>
                          <Typography variant="body2" sx={{ 
                            color: 'text.primary', 
                            fontWeight: 600,
                            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                            WebkitFontSmoothing: 'antialiased',
                            MozOsxFontSmoothing: 'grayscale',
                            textRendering: 'optimizeLegibility'
                          }}>ID: {p.id || i + 1}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ 
                      color: 'text.primary',
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>{p.dire || '-'}</TableCell>
                    <TableCell sx={{ 
                      color: 'text.primary',
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>{p.fecha || '-'}</TableCell>
                    <TableCell sx={{ 
                      color: 'text.primary',
                      fontWeight: 600,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>${p.precio ? Number(p.precio).toLocaleString() : 0}</TableCell>
                    <TableCell sx={{ 
                      color: 'text.primary',
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>{p.metodopago || '-'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={getEstadoStyle(p.status).label}
                        size="small"
                        sx={{ 
                          bgcolor: getEstadoStyle(p.status).bgcolor,
                          color: getEstadoStyle(p.status).color,
                          fontWeight: 600
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton>
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {/* Paginación rápida mejorada */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2, flexWrap: 'wrap' }}>
            <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} style={{ minWidth: 36, marginRight: 8 }}>
              Anterior
            </button>
          {/* Mostrar máximo 5 botones a la vez, con ... si hay muchas páginas */}
          {(() => {
            const botones = [];
            let start = Math.max(1, pagina - 2);
            let end = Math.min(totalPaginas, pagina + 2);
            if (pagina <= 3) {
              end = Math.min(5, totalPaginas);
            } else if (pagina >= totalPaginas - 2) {
              start = Math.max(1, totalPaginas - 4);
            }
            if (start > 1) {
              botones.push(
                  <button key={1} onClick={() => setPagina(1)} style={{ minWidth: 36, margin: '0 4px', background: pagina === 1 ? '#3b82f6' : '#fff', color: pagina === 1 ? '#fff' : '#1e293b', border: '1px solid #e2e8f0', borderRadius: 4, fontWeight: pagina === 1 ? 700 : 400 }}>1</button>
              );
              if (start > 2) {
                  botones.push(<span key="start-ellipsis" style={{ 
                    margin: '0 4px', 
                    color: '#1e293b',
                    fontWeight: 600,
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>...</span>);
                }
            }
            for (let i = start; i <= end; i++) {
              botones.push(
                <button
                  key={i}
                    onClick={() => setPagina(i)}
                    style={{ minWidth: 36, margin: '0 4px', background: pagina === i ? '#3b82f6' : '#fff', color: pagina === i ? '#fff' : '#1e293b', border: '1px solid #e2e8f0', borderRadius: 4, fontWeight: pagina === i ? 700 : 400 }}
                >
                  {i}
                </button>
              );
            }
            if (end < totalPaginas) {
              if (end < totalPaginas - 1) {
                  botones.push(<span key="end-ellipsis" style={{ 
                    margin: '0 4px', 
                    color: '#1e293b',
                    fontWeight: 600,
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>...</span>);
              }
              botones.push(
                  <button key={totalPaginas} onClick={() => setPagina(totalPaginas)} style={{ minWidth: 36, margin: '0 4px', background: pagina === totalPaginas ? '#3b82f6' : '#fff', color: pagina === totalPaginas ? '#fff' : '#1e293b', border: '1px solid #e2e8f0', borderRadius: 4, fontWeight: pagina === totalPaginas ? 700 : 400 }}>{totalPaginas}</button>
              );
            }
            return botones;
          })()}
            <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} style={{ minWidth: 36, marginLeft: 8 }}>
              Siguiente
            </button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
} 