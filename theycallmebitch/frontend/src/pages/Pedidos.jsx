import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, InputAdornment, Chip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { getPedidos } from '../services/api';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Tooltip from '@mui/material/Tooltip';

export default function Pedidos({ refreshTrigger = 0 }) {
  const [pedidos, setPedidos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
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

  // Filtro de búsqueda
  const filteredPedidos = pedidos.filter(p => {
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

  // Cards de resumen sobre los pedidos filtrados
  const ventasTotales = filteredPedidos.reduce((sum, p) => sum + (Number(p.precio) || 0), 0);
  const countEfectivo = filteredPedidos.filter(p => (p.metodopago || '').toLowerCase().includes('efectivo')).length;
  const countTransferencia = filteredPedidos.filter(p => (p.metodopago || '').toLowerCase().includes('transfer')).length;
  const countTarjeta = filteredPedidos.filter(p => (p.metodopago || '').toLowerCase().includes('tarjeta')).length;

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
          <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap' }}>
            <Card sx={{ minWidth: 220, bgcolor: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: 3, border: '1px solid #f1f5f9' }}>
              <CardContent sx={{ p: 3 }}>
                <Tooltip title="Suma total de ventas de los pedidos mostrados." placement="top" arrow>
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
                <Tooltip title="Cantidad de pedidos pagados en efectivo." placement="top" arrow>
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
                <Tooltip title="Cantidad de pedidos pagados por transferencia." placement="top" arrow>
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
                <Tooltip title="Cantidad de pedidos pagados con tarjeta." placement="top" arrow>
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