import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  Typography, 
  TextField,
  InputAdornment,
  IconButton,
  Avatar,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { 
  Search as SearchIcon, 
  FilterList as FilterListIcon, 
  Add, 
  MoreVert as MoreVertIcon, 
  LocationOn as LocationOnIcon, 
  Phone as PhoneIcon, 
  Email as EmailIcon, 
  Warning, 
  Error, 
  Info, 
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Schedule,
  LocalShipping,
  AttachMoney
} from '@mui/icons-material';
import { getClientes, getPedidos } from '../services/api';

// Los datos de clientes ahora se obtienen del backend

// Función para parsear fechas DD-MM-YYYY a Date con validación mejorada
function parseFecha(fechaStr) {
  if (!fechaStr || fechaStr.trim() === '') return null;
  
  try {
    // Si ya es ISO o YYYY-MM-DD, validar y crear Date
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
      const fecha = new Date(fechaStr);
      // Verificar que la fecha es válida
      if (isNaN(fecha.getTime())) return null;
      return fecha;
    }
    
    // Si es DD-MM-YYYY
    const match = fechaStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (match) {
      const [_, d, m, y] = match;
      const fecha = new Date(`${y}-${m}-${d}`);
      // Verificar que la fecha es válida
      if (isNaN(fecha.getTime())) return null;
      return fecha;
    }
    
    return null;
  } catch (error) {
    console.warn('Error parseando fecha:', fechaStr, error);
    return null;
  }
}

export default function Clientes({ refreshTrigger = 0 }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('Todos');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [anchorEl, setAnchorEl] = useState(null);
  
  // Estados para datos reales
  const [clientes, setClientes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para las listas apiladas
  const [searchTermVIP, setSearchTermVIP] = useState('');
  const [searchTermFrecuencia, setSearchTermFrecuencia] = useState('');
  const [clientesVIP, setClientesVIP] = useState([]);
  const [clientesFrecuencia, setClientesFrecuencia] = useState([]);

  // Función unificada para calcular estado activo/inactivo
  const calcularEstadoCliente = (fechaUltimo) => {
    if (!fechaUltimo || fechaUltimo.trim() === '') return 'Inactivo';
    
    const fecha = parseFecha(fechaUltimo);
    if (!fecha) {
      console.warn('Fecha inválida para cálculo de estado:', fechaUltimo);
      return 'Inactivo';
    }
    
    // Verificar que la fecha no sea futura (más de 1 día en el futuro)
    const hoy = new Date();
    const diffMs = hoy - fecha;
    const diffDias = diffMs / (1000 * 60 * 60 * 24);
    
    // Si la fecha es futura o muy antigua (más de 10 años), considerar inactivo
    if (diffDias < -1 || diffDias > 3650) {
      console.warn('Fecha fuera de rango razonable:', fechaUltimo, 'diferencia en días:', diffDias);
      return 'Inactivo';
    }
    
    return diffDias <= 75 ? 'Activo' : 'Inactivo';
  };

  // Enriquecer todos los clientes con estado funcional para el card y la tabla principal
  const clientesConEstado = clientes.map(cliente => {
    const estado = calcularEstadoCliente(cliente.ultimo_pedido);
    return { ...cliente, estado };
  });

  // Filtros de clientes (usar clientesConEstado)
  const filteredClientes = clientesConEstado.filter(cliente => {
    const matchesSearch = (cliente.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (cliente.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEstado = filterEstado === 'Todos' || cliente.estado === filterEstado;
    const matchesTipo = filterTipo === 'Todos' || cliente.tipo === filterTipo;
    return matchesSearch && matchesEstado && matchesTipo;
  })
  // Ordenar: primero activos, luego inactivos
  .sort((a, b) => {
    if (a.estado === b.estado) return 0;
    if (a.estado === 'Activo') return -1;
    return 1;
  });

  // Estado para paginación (debe ir después de filteredClientes)
  const [pagina, setPagina] = useState(1);
  const clientesPorPagina = 10;
  const totalPaginas = Math.ceil(filteredClientes.length / clientesPorPagina);
  const clientesPagina = filteredClientes.slice((pagina - 1) * clientesPorPagina, pagina * clientesPorPagina);

  // Resetear página si cambia el filtro
  useEffect(() => { setPagina(1); }, [searchTerm, filterEstado, filterTipo]);

  // Función para cargar datos
    const cargarDatos = async () => {
      try {
      setLoading(true);
      const [clientesDataRaw, pedidosDataRaw] = await Promise.all([
          getClientes(),
          getPedidos()
        ]);

      // Adaptar clientes
      const clientesData = clientesDataRaw.map((c, idx) => {
        return {
          id: idx + 1, // o usa c.usuario si es único
          nombre: c.usuario || '',
          email: '', // No viene en el backend
          telefono: c.telefonou || '',
          direccion: c.dire || '',
          estado: calcularEstadoCliente(c.fecha), // Usar función unificada
          tipo: 'Regular', // Puedes mejorar esto si tienes lógica para VIP
          pedidos: 0, // Se calculará después
          total_comprado: c.monto_ultimo_pedido || 0,
          ultimo_pedido: c.fecha || ''
        };
      });

      // Adaptar pedidos
      const pedidosData = pedidosDataRaw.map((p, idx) => ({
        id: idx + 1,
        cliente_id: clientesData.find(c => c.nombre === p.usuario)?.id || null,
        empresa: p.nombrelocal || '',
        precio: p.precio ? Number(p.precio) : 0,
        fecha: p.fecha || '',
        status: p.status || '',
        dire: p.dire || '', // <-- AGREGADO: dirección del pedido
      }));
        
        setClientes(clientesData);
        setPedidos(pedidosData);
        calcularListas(clientesData, pedidosData);
        
      // Log para verificar estados y fechas problemáticas
      const activos = clientesData.filter(c => c.estado === 'Activo').length;
      const inactivos = clientesData.filter(c => c.estado === 'Inactivo').length;
      
      // Verificar fechas problemáticas
      const fechasInvalidas = clientesData.filter(c => {
        const fecha = parseFecha(c.ultimo_pedido);
        return !fecha && c.ultimo_pedido && c.ultimo_pedido.trim() !== '';
      });
      
      console.log('Datos actualizados:', new Date().toLocaleTimeString());
      console.log(`Estados calculados: ${activos} activos, ${inactivos} inactivos`);
      
      if (fechasInvalidas.length > 0) {
        console.warn('Fechas inválidas encontradas:', fechasInvalidas.map(c => ({
          cliente: c.nombre,
          fecha: c.ultimo_pedido
        })));
      }
      } catch (error) {
        console.error('Error cargando datos:', error);
        setClientes([]);
        setPedidos([]);
      } finally {
        setLoading(false);
      }
    };
    
  // Cargar datos iniciales y cuando se solicita actualización manual
  useEffect(() => {
    cargarDatos();
  }, [refreshTrigger]);

  // Actualización automática cada 10 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Actualización automática iniciada:', new Date().toLocaleTimeString());
      cargarDatos();
    }, 10 * 60 * 1000); // 10 minutos

    // Escuchar evento de actualización global
    const handleGlobalRefresh = () => {
      console.log('Actualización global detectada en Clientes...');
      cargarDatos();
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('globalRefresh', handleGlobalRefresh);
    };
  }, []);

  // Función para normalizar dirección
  function normalizarDireccion(dir) {
    return (dir || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // Función para obtener clave de agrupación
  function claveAgrupacion(dir) {
    const norm = normalizarDireccion(dir);
    if (norm.includes('avenida la florida 10269')) {
      // Buscar número de departamento (tres dígitos)
      const match = norm.match(/avenida la florida 10269.*?(\d{3})/);
      if (match) {
        return `avenida la florida 10269 depto ${match[1]}`;
      }
      // Si no hay número, agrupa solo por la dirección base
      return 'avenida la florida 10269';
    }
    return norm;
  }

  // Función para calcular las listas VIP y frecuencia
  const calcularListas = (clientesData, pedidosData) => {
    // Mapear compras por clave de agrupación
    const comprasPorClave = {};
    pedidosData.forEach(pedido => {
      const clave = claveAgrupacion(pedido.dire || pedido.direccion);
      if (!clave) return;
      if (!comprasPorClave[clave]) {
        comprasPorClave[clave] = { total: 0, frecuencia: 0, ultimo: null };
      }
      comprasPorClave[clave].total += pedido.precio;
      comprasPorClave[clave].frecuencia += 1;
      if (!comprasPorClave[clave].ultimo || new Date(pedido.fecha) > new Date(comprasPorClave[clave].ultimo)) {
        comprasPorClave[clave].ultimo = pedido.fecha;
      }
    });

    // Agrupar clientes por clave de agrupación
    const clientesPorClave = {};
    clientesData.forEach(cliente => {
      const clave = claveAgrupacion(cliente.direccion);
      if (!clave) return;
      if (!clientesPorClave[clave]) {
        clientesPorClave[clave] = { ...cliente };
      } else {
        clientesPorClave[clave].total_comprado += cliente.total_comprado || 0;
        clientesPorClave[clave].pedidos += cliente.pedidos || 0;
        const fechaExistente = clientesPorClave[clave].ultimo_pedido;
        const fechaNueva = cliente.ultimo_pedido;
        if (fechaNueva && (!fechaExistente || new Date(fechaNueva) > new Date(fechaExistente))) {
          clientesPorClave[clave].ultimo_pedido = fechaNueva;
        }
      }
    });

    // Enriquecer clientes agrupados con compras
    const clientesEnriquecidos = Object.values(clientesPorClave).map(cliente => {
      const clave = claveAgrupacion(cliente.direccion);
      const compras = comprasPorClave[clave] || { total: 0, frecuencia: 0, ultimo: null };
      // Calcular bidones por pedido (asumiendo cada pedido es por 1 o más bidones de 20L, y precio unitario 2000)
      const totalBidones = compras.total ? Math.round(compras.total / 2000) : 0;
      const bidonesPorPedido = compras.frecuencia > 0 ? (totalBidones / compras.frecuencia) : 0;
      
      // Usar la fecha más reciente entre compras.ultimo y cliente.ultimo_pedido
      const fechaCompras = compras.ultimo || '';
      const fechaCliente = cliente.ultimo_pedido || '';
      const fechaFinal = fechaCompras && fechaCliente ? 
        (new Date(fechaCompras) > new Date(fechaCliente) ? fechaCompras : fechaCliente) :
        (fechaCompras || fechaCliente);
      
      // Calcular estado funcional usando función unificada
      const estado = calcularEstadoCliente(fechaFinal);
      
      // Debug para Walker Martinez
      if (cliente.nombre && cliente.nombre.toLowerCase().includes('walker')) {
        console.log('Walker en lista VIP:', {
          nombre: cliente.nombre,
          fechaCompras: fechaCompras,
          fechaCliente: fechaCliente,
          fechaFinal: fechaFinal,
          estado: estado
        });
      }
      
      return {
        ...cliente,
        total_comprado: compras.total,
        pedidos: compras.frecuencia,
        ultimo_pedido: fechaFinal,
        bidonesPorPedido: bidonesPorPedido,
        estado: estado
      };
    });

    // Top 15 VIP (más dinero aportado)
    const topVIP = [...clientesEnriquecidos]
      .sort((a, b) => b.total_comprado - a.total_comprado)
      .slice(0, 15);

    // Top 15 Frecuencia (más compras)
    const topFrecuencia = [...clientesEnriquecidos]
      .sort((a, b) => b.pedidos - a.pedidos)
      .slice(0, 15);

    setClientesVIP(topVIP);
    setClientesFrecuencia(topFrecuencia);
  };

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Filtros de estado para listas VIP y Frecuencia
  const [filtroEstadoVIP, setFiltroEstadoVIP] = useState('Todos');
  const [filtroEstadoFrecuencia, setFiltroEstadoFrecuencia] = useState('Todos');
  
  // Estado para controlar el período de análisis de crecimiento
  const [periodoCrecimiento, setPeriodoCrecimiento] = useState('12meses'); // '12meses' o '6meses'

  // Filtrar VIP y Frecuencia según el filtro de estado
  const filteredVIP = clientesVIP.filter(cliente => 
    (filtroEstadoVIP === 'Todos' || cliente.estado === filtroEstadoVIP) &&
    ((cliente.nombre || '').toLowerCase().includes(searchTermVIP.toLowerCase()) ||
     (cliente.email || '').toLowerCase().includes(searchTermVIP.toLowerCase()))
  );

  const filteredFrecuencia = clientesFrecuencia.filter(cliente => 
    (filtroEstadoFrecuencia === 'Todos' || cliente.estado === filtroEstadoFrecuencia) &&
    ((cliente.nombre || '').toLowerCase().includes(searchTermFrecuencia.toLowerCase()) ||
     (cliente.email || '').toLowerCase().includes(searchTermFrecuencia.toLowerCase()))
  );

  // Calcular clientes que están en ambas listas (VIP y Frecuencia)
  const direccionesVIP = new Set(clientesVIP.map(c => (c.direccion || '').toLowerCase()));
  const direccionesFrecuencia = new Set(clientesFrecuencia.map(c => (c.direccion || '').toLowerCase()));
  const clientesVIPyFrecuencia = clientesVIP.filter(c => direccionesFrecuencia.has((c.direccion || '').toLowerCase()));
  const cantidadVIPyFrecuencia = clientesVIPyFrecuencia.length;
  const tooltipVIPyFrecuencia = clientesVIPyFrecuencia.map(c => c.direccion || 'Sin dirección').join('\n');

  // Calcular clientes reactivados
  const clientesReactivados = (() => {
    // Agrupar pedidos por dirección normalizada
    const pedidosPorDireccion = {};
    pedidos.forEach(pedido => {
      const dirNorm = (pedido.dire || pedido.direccion || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!dirNorm) return;
      if (!pedidosPorDireccion[dirNorm]) pedidosPorDireccion[dirNorm] = [];
      pedidosPorDireccion[dirNorm].push(pedido);
    });
    let count = 0;
    Object.values(pedidosPorDireccion).forEach(listaPedidos => {
      if (listaPedidos.length < 2) return;
      // Ordenar por fecha ascendente
      listaPedidos.sort((a, b) => {
        const fa = parseFecha(a.fecha);
        const fb = parseFecha(b.fecha);
        return fa - fb;
      });
      let reactivado = false;
      for (let i = 1; i < listaPedidos.length; i++) {
        const fechaPrev = parseFecha(listaPedidos[i - 1].fecha);
        const fechaActual = parseFecha(listaPedidos[i].fecha);
        if (fechaPrev && fechaActual) {
          const diff = (fechaActual - fechaPrev) / (1000 * 60 * 60 * 24);
          if (diff > 75) {
            reactivado = true;
            break;
          }
        }
      }
      if (reactivado) count++;
    });
    return count;
  })();

  // Componente reutilizable para tabla de clientes
  const TablaClientes = ({ clientes, searchTerm, onSearchChange, titulo, mostrarDireccionSolo = false }) => (
    <Card sx={{ 
      bgcolor: '#fff',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      borderRadius: 3,
      border: '1px solid #f1f5f9',
      mb: 3
    }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
            {titulo}
          </Typography>
          <TextField
            placeholder="Buscar en esta lista..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            size="small"
            sx={{
              width: 300,
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                bgcolor: '#f8fafc',
                '& fieldset': {
                  borderColor: '#e2e8f0',
                },
                '&:hover fieldset': {
                  borderColor: '#cbd5e1',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#3b82f6',
                },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#64748b' }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Cliente</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Contacto</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Estado</TableCell>
                {mostrarDireccionSolo ? (
                  <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Bidones por Pedido</TableCell>
                ) : (
                <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Tipo</TableCell>
                )}
                <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Pedidos</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Total Comprado</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Último Pedido</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clientes.map((cliente) => (
                <TableRow key={cliente.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: '#3b82f6' }}>
                        {(mostrarDireccionSolo ? (cliente.direccion || '?') : (cliente.nombre || '?')).charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {mostrarDireccionSolo ? (cliente.direccion || 'Sin dirección') : cliente.nombre}
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          color: '#1e293b', 
                          fontWeight: 600,
                          fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                          WebkitFontSmoothing: 'antialiased',
                          MozOsxFontSmoothing: 'grayscale',
                          textRendering: 'optimizeLegibility'
                        }}>
                          ID: {cliente.id}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <EmailIcon sx={{ fontSize: 16, color: '#1e293b' }} />
                        <Typography variant="body2" sx={{ 
                          color: '#1e293b', 
                          fontWeight: 600,
                          fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                          WebkitFontSmoothing: 'antialiased',
                          MozOsxFontSmoothing: 'grayscale',
                          textRendering: 'optimizeLegibility'
                        }}>
                          {cliente.email}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon sx={{ fontSize: 16, color: '#1e293b' }} />
                        <Typography variant="body2" sx={{ 
                          color: '#1e293b', 
                          fontWeight: 600,
                          fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                          WebkitFontSmoothing: 'antialiased',
                          MozOsxFontSmoothing: 'grayscale',
                          textRendering: 'optimizeLegibility'
                        }}>
                          {cliente.telefono}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={cliente.estado} 
                      size="small" 
                      sx={{ 
                        bgcolor: cliente.estado === 'Activo' ? '#dcfce7' : '#fee2e2',
                        color: cliente.estado === 'Activo' ? '#166534' : '#dc2626',
                        fontWeight: 600
                      }}
                    />
                  </TableCell>
                  {mostrarDireccionSolo ? (
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                        {cliente.bidonesPorPedido ? Math.round(cliente.bidonesPorPedido) : '0'}
                      </Typography>
                    </TableCell>
                  ) : (
                  <TableCell>
                    <Chip 
                      label={cliente.tipo} 
                      size="small" 
                      sx={{ 
                        bgcolor: cliente.tipo === 'VIP' ? '#fef3c7' : '#dbeafe',
                        color: cliente.tipo === 'VIP' ? '#92400e' : '#1e40af',
                        fontWeight: 600
                      }}
                    />
                  </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                      {cliente.pedidos || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                      ${(cliente.total_comprado || 0).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ 
                      color: '#1e293b', 
                      fontWeight: 600,
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      {(() => {
                        const fecha = parseFecha(cliente.ultimo_pedido);
                        return fecha && !isNaN(fecha) ? fecha.toLocaleDateString('es-ES') : 'N/A';
                      })()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={handleMenuClick}>
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );

  // Estadísticas rápidas
  const totalClientes = clientes.length;
  const totalClientesActivos = clientesConEstado.filter(c => c.estado === 'Activo').length;
  const totalClientesVIP = clientes.filter(c => c.total_comprado > 0).length;
  const totalVentas = clientes.reduce((sum, c) => sum + (c.total_comprado || 0), 0);
  // Calcular churn (clientes inactivos)
  const churnAbs = clientesConEstado.filter(c => c.estado === 'Inactivo').length;
  const churnPct = totalClientes > 0 ? Math.round((churnAbs / totalClientes) * 100) : 0;

  // Card: Clientes Nuevos (últimos 75 días) - corregido usando la primera compra
  const clientesNuevos = (() => {
    const hoy = new Date();
    // Agrupar pedidos por dirección normalizada
    const pedidosPorDireccion = {};
    pedidos.forEach(pedido => {
      const dirNorm = (pedido.dire || pedido.direccion || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!dirNorm) return;
      if (!pedidosPorDireccion[dirNorm]) pedidosPorDireccion[dirNorm] = [];
      pedidosPorDireccion[dirNorm].push(pedido);
    });
    let count = 0;
    Object.values(pedidosPorDireccion).forEach(listaPedidos => {
      if (!listaPedidos.length) return;
      // Buscar la fecha más antigua
      const fechas = listaPedidos.map(p => parseFecha(p.fecha)).filter(Boolean);
      if (!fechas.length) return;
      const fechaPrimera = fechas.reduce((a, b) => a < b ? a : b);
      const diff = (hoy - fechaPrimera) / (1000 * 60 * 60 * 24);
      if (diff <= 75) count++;
    });
    return count;
  })();

  // Card: Clientes en Riesgo (60-75 días sin comprar)
  const clientesEnRiesgo = clientesConEstado.filter(c => {
    const fechaUltimo = parseFecha(c.ultimo_pedido || '');
    if (!fechaUltimo) return false;
    const hoy = new Date();
    const diff = (hoy - fechaUltimo) / (1000 * 60 * 60 * 24);
    return diff > 60 && diff <= 75;
  }).length;

  // Lista: Top 15 Ticket Promedio
  const topTicketPromedio = [...clientesVIP, ...clientesFrecuencia]
    .filter(c => c.pedidos > 0)
    .reduce((acc, c) => {
      // Evitar duplicados por dirección
      if (!acc.some(x => (x.direccion || '').toLowerCase() === (c.direccion || '').toLowerCase())) acc.push(c);
      return acc;
    }, [])
    .map(c => ({ ...c, ticketPromedio: c.total_comprado / c.pedidos }))
    .sort((a, b) => b.ticketPromedio - a.ticketPromedio)
    .slice(0, 15);

  // Lista: Top 15 Crecimiento (dinámico según período seleccionado)
  const topCrecimiento = (() => {
    // Agrupar pedidos por dirección
    const pedidosPorDireccion = {};
    pedidos.forEach(p => {
      const dirNorm = (p.dire || p.direccion || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!dirNorm) return;
      if (!pedidosPorDireccion[dirNorm]) pedidosPorDireccion[dirNorm] = [];
      pedidosPorDireccion[dirNorm].push(p);
    });
    
    const hoy = new Date();
    
    // Definir períodos según la selección
    let periodoActual, periodoAnterior, nombrePeriodoActual, nombrePeriodoAnterior;
    
    if (periodoCrecimiento === '12meses') {
      // 12 meses: últimos 6 meses vs 6 meses previos
      periodoActual = new Date(hoy.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
      periodoAnterior = new Date(hoy.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);
      nombrePeriodoActual = 'Últimos 6 meses';
      nombrePeriodoAnterior = '6 meses previos';
    } else {
      // 6 meses: últimos 3 meses vs 3 meses previos
      periodoActual = new Date(hoy.getTime() - 3 * 30 * 24 * 60 * 60 * 1000);
      periodoAnterior = new Date(hoy.getTime() - 6 * 30 * 24 * 60 * 60 * 1000);
      nombrePeriodoActual = 'Últimos 3 meses';
      nombrePeriodoAnterior = '3 meses previos';
    }
    
    const crecimientoPorDireccion = Object.entries(pedidosPorDireccion).map(([dir, lista]) => {
      let montoPeriodoActual = 0, montoPeriodoAnterior = 0;
      let pedidosPeriodoActual = 0, pedidosPeriodoAnterior = 0;
      
      lista.forEach(p => {
        const f = parseFecha(p.fecha);
        if (!f) return;
        
        if (f >= periodoActual) {
          montoPeriodoActual += Number(p.precio || 0);
          pedidosPeriodoActual++;
        } else if (f >= periodoAnterior && f < periodoActual) {
          montoPeriodoAnterior += Number(p.precio || 0);
          pedidosPeriodoAnterior++;
        }
      });
      
      // Calcular crecimiento y porcentaje
      const crecimiento = montoPeriodoAnterior === 0 ? montoPeriodoActual : montoPeriodoActual - montoPeriodoAnterior;
      const porcentajeCrecimiento = montoPeriodoAnterior === 0 ? 
        (montoPeriodoActual > 0 ? 100 : 0) : 
        ((montoPeriodoActual - montoPeriodoAnterior) / montoPeriodoAnterior) * 100;
      
      return {
        direccion: dir,
        crecimiento,
        porcentajeCrecimiento,
        montoPeriodoActual,
        montoPeriodoAnterior,
        pedidosPeriodoActual,
        pedidosPeriodoAnterior,
        promedioPeriodoActual: pedidosPeriodoActual > 0 ? montoPeriodoActual / pedidosPeriodoActual : 0,
        promedioPeriodoAnterior: pedidosPeriodoAnterior > 0 ? montoPeriodoAnterior / pedidosPeriodoAnterior : 0,
        nombrePeriodoActual,
        nombrePeriodoAnterior
      };
    });
    
    return crecimientoPorDireccion
      .filter(c => c.montoPeriodoActual > 0) // Solo clientes con actividad reciente
      .sort((a, b) => b.porcentajeCrecimiento - a.porcentajeCrecimiento) // Ordenar por porcentaje de crecimiento
      .slice(0, 15);
  })();

  return (
    <Box sx={{ 
      display: 'flex', 
      height: '100vh', 
      bgcolor: '#f8fafc',
      overflow: 'auto'
    }}>
      
      {/* Contenido principal */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
          
          {/* Header con buscador y filtros */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            mb: 4,
            bgcolor: '#fff',
            p: 3,
            borderRadius: 3,
            boxShadow: '0 2px 10px rgba(0,0,0,0.08)'
          }}>
            <Typography variant="h4" sx={{ 
              fontWeight: 700, 
              color: '#1e293b',
              fontSize: '2rem'
            }}>
              Clientes
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                placeholder="Buscar clientes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
                sx={{
                  width: 300,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 3,
                    bgcolor: '#f8fafc',
                    '& fieldset': {
                      borderColor: '#e2e8f0',
                    },
                    '&:hover fieldset': {
                      borderColor: '#cbd5e1',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#3b82f6',
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#64748b' }} />
                    </InputAdornment>
                  ),
                }}
              />
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Estado</InputLabel>
                <Select
                  value={filterEstado}
                  label="Estado"
                  onChange={(e) => setFilterEstado(e.target.value)}
                  sx={{
                    borderRadius: 3,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e2e8f0',
                    },
                  }}
                >
                  <MenuItem value="Todos">Todos</MenuItem>
                  <MenuItem value="Activo">Activo</MenuItem>
                  <MenuItem value="Inactivo">Inactivo</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={filterTipo}
                  label="Tipo"
                  onChange={(e) => setFilterTipo(e.target.value)}
                  sx={{
                    borderRadius: 3,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#e2e8f0',
                    },
                  }}
                >
                  <MenuItem value="Todos">Todos</MenuItem>
                  <MenuItem value="VIP">VIP</MenuItem>
                  <MenuItem value="Regular">Regular</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                startIcon={<Add />}
                sx={{
                  bgcolor: '#10b981',
                  '&:hover': { bgcolor: '#059669' },
                  borderRadius: 3,
                  px: 3,
                  py: 1
                }}
              >
                Nuevo Cliente
              </Button>
            </Box>
          </Box>

          {/* Estadísticas rápidas */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid xs={12} md={3}>
              <Card sx={{ 
                bgcolor: '#fff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                borderRadius: 3,
                border: '1px solid #f1f5f9'
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Tooltip title="Cantidad total de clientes únicos registrados en el sistema." placement="top" arrow>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>{totalClientes}</Typography>
                  </Tooltip>
                  <Typography variant="body1" sx={{ 
                    color: '#1e293b', 
                    fontWeight: 600,
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>Total Clientes</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid xs={12} md={3}>
              <Card sx={{ 
                bgcolor: '#fff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                borderRadius: 3,
                border: '1px solid #f1f5f9'
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Tooltip title="Clientes que han realizado al menos un pedido en los últimos 75 días." placement="top" arrow>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>{totalClientesActivos}</Typography>
                  </Tooltip>
                  <Typography variant="body1" sx={{ 
                    color: '#1e293b', 
                    fontWeight: 600,
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>Clientes Activos</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid xs={12} md={3}>
              <Card sx={{ 
                bgcolor: '#fff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                borderRadius: 3,
                border: '1px solid #f1f5f9'
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Tooltip title="Clientes que están tanto en el top 15 de mayor dinero aportado como en el top 15 de mayor frecuencia de compra." placement="top" arrow>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>{cantidadVIPyFrecuencia}</Typography>
                  </Tooltip>
                  <Typography variant="body1" sx={{ 
                    color: '#1e293b', 
                    fontWeight: 600,
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>Clientes VIP</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid xs={12} md={3}>
              <Card sx={{ 
                bgcolor: '#fff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                borderRadius: 3,
                border: '1px solid #f1f5f9'
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Tooltip title="Clientes que volvieron a comprar después de más de 75 días sin hacerlo." placement="top" arrow>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>{clientesReactivados}</Typography>
                  </Tooltip>
                  <Typography variant="body1" sx={{ 
                    color: '#1e293b', 
                    fontWeight: 600,
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>Clientes Reactivados</Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid xs={12} md={3}>
              <Card sx={{ 
                bgcolor: '#fff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                borderRadius: 3,
                border: '1px solid #f1f5f9'
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Tooltip title="Clientes que llevan más de 75 días sin comprar (churn absoluto y porcentaje)." placement="top" arrow>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>{churnAbs} ({churnPct}%)</Typography>
                  </Tooltip>
                  <Typography variant="body1" sx={{ 
                    color: '#1e293b', 
                    fontWeight: 600,
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>Churn</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} md={3}>
              <Card sx={{ 
                bgcolor: '#fff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                borderRadius: 3,
                border: '1px solid #f1f5f9'
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Tooltip title="Clientes cuya primera compra fue en los últimos 75 días." placement="top" arrow>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>{clientesNuevos}</Typography>
                  </Tooltip>
                  <Typography variant="body1" sx={{ 
                    color: '#1e293b', 
                    fontWeight: 600,
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>Clientes Nuevos (75 días)</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid xs={12} md={3}>
              <Card sx={{ 
                bgcolor: '#fff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                borderRadius: 3,
                border: '1px solid #f1f5f9'
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Tooltip title="Clientes que llevan entre 60 y 75 días sin comprar (cerca de volverse inactivos)." placement="top" arrow>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}>{clientesEnRiesgo}</Typography>
                  </Tooltip>
                  <Typography variant="body1" sx={{ 
                    color: '#1e293b', 
                    fontWeight: 600,
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>Clientes en Riesgo</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Tabla de Clientes Principal */}
          <Card sx={{ 
            bgcolor: '#fff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            borderRadius: 3,
            border: '1px solid #f1f5f9',
            mb: 4
          }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Cliente</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Contacto</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Estado</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Tipo</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Pedidos</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Total Comprado</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Último Pedido</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clientesPagina.map((cliente) => (
                    <TableRow key={cliente.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Avatar sx={{ bgcolor: '#3b82f6' }}>
                            {cliente.nombre.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                              {cliente.nombre}
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              color: '#1e293b', 
                              fontWeight: 600,
                              fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                              textRendering: 'optimizeLegibility'
                            }}>
                              ID: {cliente.id}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <EmailIcon sx={{ fontSize: 16, color: '#1e293b' }} />
                            <Typography variant="body2" sx={{ 
                              color: '#1e293b', 
                              fontWeight: 600,
                              fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                              textRendering: 'optimizeLegibility'
                            }}>
                              {cliente.email}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <PhoneIcon sx={{ fontSize: 16, color: '#1e293b' }} />
                            <Typography variant="body2" sx={{ 
                              color: '#1e293b', 
                              fontWeight: 600,
                              fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                              textRendering: 'optimizeLegibility'
                            }}>
                              {cliente.telefono}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={cliente.estado} 
                          size="small" 
                          sx={{ 
                            bgcolor: cliente.estado === 'Activo' ? '#dcfce7' : '#fee2e2',
                            color: cliente.estado === 'Activo' ? '#166534' : '#dc2626',
                            fontWeight: 600
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={cliente.tipo} 
                          size="small" 
                          sx={{ 
                            bgcolor: cliente.tipo === 'VIP' ? '#fef3c7' : '#dbeafe',
                            color: cliente.tipo === 'VIP' ? '#92400e' : '#1e40af',
                            fontWeight: 600
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {cliente.pedidos || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          ${(cliente.total_comprado || 0).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                          {cliente.ultimo_pedido ? 
                            (() => {
                              const fecha = parseFecha(cliente.ultimo_pedido);
                              if (fecha) {
                                return fecha.toLocaleDateString('es-ES');
                              } else {
                                return (
                                  <Box>
                                    <Typography variant="body2" sx={{ color: '#dc2626', fontSize: '0.75rem' }}>
                                      Fecha inválida
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                                      {cliente.ultimo_pedido}
                                    </Typography>
                                  </Box>
                                );
                              }
                            })() : 'N/A'
                          }
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton onClick={handleMenuClick}>
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {/* Paginación */}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
              <Button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} sx={{ minWidth: 36 }}>
                Anterior
              </Button>
              {[...Array(totalPaginas)].map((_, i) => (
                <Button
                  key={i + 1}
                  onClick={() => setPagina(i + 1)}
                  variant={pagina === i + 1 ? 'contained' : 'outlined'}
                  sx={{ minWidth: 36, mx: 0.5 }}
                >
                  {i + 1}
                </Button>
              ))}
              <Button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} sx={{ minWidth: 36 }}>
                Siguiente
              </Button>
            </Box>
          </Card>

          {/* Lista VIP - Top 15 por monto */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Estado</InputLabel>
              <Select
                value={filtroEstadoVIP}
                label="Estado"
                onChange={e => setFiltroEstadoVIP(e.target.value)}
                sx={{ borderRadius: 3 }}
              >
                <MenuItem value="Todos">Todos</MenuItem>
                <MenuItem value="Activo">Solo Activos</MenuItem>
                <MenuItem value="Inactivo">Solo Inactivos</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TablaClientes 
            clientes={filteredVIP}
            searchTerm={searchTermVIP}
            onSearchChange={setSearchTermVIP}
            titulo="Top 15 Clientes VIP (Mayor Monto)"
            mostrarDireccionSolo={true}
          />

          {/* Lista Frecuencia - Top 15 por frecuencia */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Estado</InputLabel>
              <Select
                value={filtroEstadoFrecuencia}
                label="Estado"
                onChange={e => setFiltroEstadoFrecuencia(e.target.value)}
                sx={{ borderRadius: 3 }}
              >
                <MenuItem value="Todos">Todos</MenuItem>
                <MenuItem value="Activo">Solo Activos</MenuItem>
                <MenuItem value="Inactivo">Solo Inactivos</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TablaClientes 
            clientes={filteredFrecuencia}
            searchTerm={searchTermFrecuencia}
            onSearchChange={setSearchTermFrecuencia}
            titulo="Top 15 Clientes por Frecuencia de Compra"
            mostrarDireccionSolo={true}
          />

          {/* Top 15 Ticket Promedio */}
          <TablaClientes 
            clientes={topTicketPromedio}
            searchTerm={''}
            onSearchChange={() => {}}
            titulo="Top 15 Ticket Promedio"
            mostrarDireccionSolo={true}
          />

          {/* Top 15 Clientes con Mayor Crecimiento (con pestañas de período) */}
          <Card sx={{ bgcolor: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderRadius: 3, border: '1px solid #f1f5f9', mb: 4 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                  Top 15 Clientes con Mayor % de Crecimiento
                </Typography>
                
                {/* Pestañas de período */}
                <Box sx={{ display: 'flex', bgcolor: '#f1f5f9', borderRadius: 2, p: 0.5 }}>
                  <Button
                    onClick={() => setPeriodoCrecimiento('12meses')}
                    sx={{
                      px: 3,
                      py: 1,
                      borderRadius: 1.5,
                      bgcolor: periodoCrecimiento === '12meses' ? '#3b82f6' : 'transparent',
                      color: periodoCrecimiento === '12meses' ? '#fff' : '#64748b',
                      fontWeight: periodoCrecimiento === '12meses' ? 600 : 400,
                      '&:hover': {
                        bgcolor: periodoCrecimiento === '12meses' ? '#2563eb' : '#e2e8f0'
                      }
                    }}
                  >
                    12 meses (6+6)
                  </Button>
                  <Button
                    onClick={() => setPeriodoCrecimiento('6meses')}
                    sx={{
                      px: 3,
                      py: 1,
                      borderRadius: 1.5,
                      bgcolor: periodoCrecimiento === '6meses' ? '#3b82f6' : 'transparent',
                      color: periodoCrecimiento === '6meses' ? '#fff' : '#64748b',
                      fontWeight: periodoCrecimiento === '6meses' ? 600 : 400,
                      '&:hover': {
                        bgcolor: periodoCrecimiento === '6meses' ? '#2563eb' : '#e2e8f0'
                      }
                    }}
                  >
                    6 meses (3+3)
                  </Button>
                </Box>
              </Box>
              
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Dirección</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Crecimiento ($)</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>% Crecimiento</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>
                        {topCrecimiento.length > 0 ? topCrecimiento[0].nombrePeriodoActual : 'Período Actual'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>
                        {topCrecimiento.length > 0 ? topCrecimiento[0].nombrePeriodoAnterior : 'Período Anterior'}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Promedio actual</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>Promedio anterior</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topCrecimiento.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Typography variant="body1" sx={{ 
                            fontWeight: 600, 
                            color: '#1e293b',
                            WebkitFontSmoothing: 'antialiased',
                            MozOsxFontSmoothing: 'grayscale',
                            textRendering: 'optimizeLegibility',
                            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
                          }}>
                            {c.direccion}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body1" sx={{ 
                            fontWeight: 600, 
                            color: c.crecimiento >= 0 ? '#059669' : '#dc2626',
                            WebkitFontSmoothing: 'antialiased',
                            MozOsxFontSmoothing: 'grayscale',
                            textRendering: 'optimizeLegibility',
                            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
                          }}>
                            ${c.crecimiento.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={`${c.porcentajeCrecimiento >= 0 ? '+' : ''}${c.porcentajeCrecimiento.toFixed(1)}%`}
                            size="small"
                            sx={{ 
                              bgcolor: c.porcentajeCrecimiento >= 0 ? '#dcfce7' : '#fee2e2',
                              color: c.porcentajeCrecimiento >= 0 ? '#166534' : '#dc2626',
                              fontWeight: 600
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body1" sx={{ 
                              fontWeight: 600, 
                              color: '#1e293b',
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                              textRendering: 'optimizeLegibility',
                              fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
                            }}>
                              ${c.montoPeriodoActual.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              color: '#64748b',
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                              textRendering: 'optimizeLegibility',
                              fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
                            }}>
                              ({c.pedidosPeriodoActual} pedidos)
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body1" sx={{ 
                              fontWeight: 600, 
                              color: '#1e293b',
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                              textRendering: 'optimizeLegibility',
                              fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
                            }}>
                              ${c.montoPeriodoAnterior.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              color: '#64748b',
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                              textRendering: 'optimizeLegibility',
                              fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
                            }}>
                              ({c.pedidosPeriodoAnterior} pedidos)
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ 
                            color: '#64748b',
                            WebkitFontSmoothing: 'antialiased',
                            MozOsxFontSmoothing: 'grayscale',
                            textRendering: 'optimizeLegibility',
                            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
                          }}>
                            ${c.promedioPeriodoActual.toFixed(0)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ 
                            color: '#64748b',
                            WebkitFontSmoothing: 'antialiased',
                            MozOsxFontSmoothing: 'grayscale',
                            textRendering: 'optimizeLegibility',
                            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif'
                          }}>
                            ${c.promedioPeriodoAnterior.toFixed(0)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* 🔔 SECCIÓN DE ALERTAS INTELIGENTES */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" sx={{ 
          fontWeight: 700, 
          color: '#1e293b', 
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Warning sx={{ color: '#f59e0b' }} />
          Alertas Inteligentes
        </Typography>

        <Grid container spacing={3}>
          {/* Alertas de Clientes Inactivos */}
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              bgcolor: '#fff', 
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)', 
              borderRadius: 3, 
              border: '1px solid #f1f5f9',
              height: '100%'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Error sx={{ color: '#dc2626', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    Clientes en Riesgo
                  </Typography>
                </Box>

                {clientesConEstado.filter(c => c.estado === 'Inactivo').slice(0, 5).map((cliente, index) => (
                  <Alert 
                    key={index}
                    severity="warning" 
                    sx={{ mb: 2 }}
                    action={
                      <Button color="inherit" size="small">
                        Contactar
                      </Button>
                    }
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {cliente.nombre || cliente.direccion}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Último pedido: {cliente.ultimo_pedido || 'N/A'}
                    </Typography>
                  </Alert>
                ))}

                {clientesConEstado.filter(c => c.estado === 'Inactivo').length === 0 && (
                  <Alert severity="success">
                    ¡Excelente! No hay clientes inactivos.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Alertas de Demanda */}
          <Grid item xs={12} md={6}>
            <Card sx={{ 
              bgcolor: '#fff', 
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)', 
              borderRadius: 3, 
              border: '1px solid #f1f5f9',
              height: '100%'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <TrendingDown sx={{ color: '#f59e0b', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    Análisis de Demanda
                  </Typography>
                </Box>

                {/* Calcular métricas de demanda */}
                {(() => {
                  const clientesActivos = clientesConEstado.filter(c => c.estado === 'Activo');
                  const clientesInactivos = clientesConEstado.filter(c => c.estado === 'Inactivo');
                  const tasaActividad = clientesActivos.length / (clientesActivos.length + clientesInactivos.length) * 100;
                  
                  return (
                    <>
                      <Alert 
                        severity={tasaActividad >= 70 ? "success" : tasaActividad >= 50 ? "warning" : "error"}
                        sx={{ mb: 2 }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Tasa de Actividad: {tasaActividad.toFixed(1)}%
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {clientesActivos.length} activos / {clientesInactivos.length} inactivos
                        </Typography>
                      </Alert>

                      {clientesInactivos.length > clientesActivos.length * 0.3 && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Alta tasa de inactividad detectada
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            Considerar campaña de reactivación
                          </Typography>
                        </Alert>
                      )}

                      {clientesActivos.length > 0 && (
                        <Alert severity="info">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Oportunidad de crecimiento
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b' }}>
                            {clientesInactivos.length} clientes potenciales para reactivar
                          </Typography>
                        </Alert>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </Grid>

          {/* Alertas de Rendimiento */}
          <Grid item xs={12}>
            <Card sx={{ 
              bgcolor: '#fff', 
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)', 
              borderRadius: 3, 
              border: '1px solid #f1f5f9'
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <AttachMoney sx={{ color: '#059669', fontSize: 28 }} />
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    Análisis de Rendimiento
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  {/* Métricas de rendimiento */}
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: '#059669' }}>
                        {clientesVIP.length}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Clientes VIP
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: '#3b82f6' }}>
                        {clientesFrecuencia.length}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Clientes Frecuentes
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: '#f59e0b' }}>
                        {cantidadVIPyFrecuencia}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        VIP + Frecuentes
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                {/* Recomendaciones */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Recomendaciones Automáticas
                  </Typography>
                  
                  <List>
                    {clientesVIP.length < 10 && (
                      <ListItem>
                        <ListItemIcon>
                          <TrendingUp sx={{ color: '#059669' }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Desarrollar programa VIP"
                          secondary="Menos de 10 clientes VIP detectados"
                        />
                      </ListItem>
                    )}

                    {clientesInactivos.length > 20 && (
                      <ListItem>
                        <ListItemIcon>
                          <Schedule sx={{ color: '#f59e0b' }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Campaña de reactivación urgente"
                          secondary={`${clientesInactivos.length} clientes inactivos`}
                        />
                      </ListItem>
                    )}

                    {cantidadVIPyFrecuencia > 0 && (
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircle sx={{ color: '#059669' }} />
                        </ListItemIcon>
                        <ListItemText 
                          primary="Clientes de alto valor identificados"
                          secondary={`${cantidadVIPyFrecuencia} clientes VIP y frecuentes`}
                        />
                      </ListItem>
                    )}
                  </List>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Menú de acciones */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        sx={{
          '& .MuiPaper-root': {
            borderRadius: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }
        }}
      >
        <MenuItem onClick={handleMenuClose}>Ver Detalles</MenuItem>
        <MenuItem onClick={handleMenuClose}>Editar Cliente</MenuItem>
        <MenuItem onClick={handleMenuClose}>Ver Pedidos</MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: '#dc2626' }}>Eliminar</MenuItem>
      </Menu>
    </Box>
  );
} 