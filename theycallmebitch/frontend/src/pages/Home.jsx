import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import FinancialKpiCard from '../components/FinancialKpiCard';
import ChartCard from '../components/ChartCard';
import CapacidadCard from '../components/CapacidadCard';
import KpiMetaCard from '../components/KpiMetaCard';
import VentasCard from '../components/VentasCard';
import VentasMensualesCard from '../components/VentasMensualesCard';
import PedidosPorBloqueDonut from '../components/PedidosPorBloqueDonut';
import VentasSemanalesCard from '../components/VentasSemanalesCard';
import VentasDiariasCard from '../components/VentasDiariasCard';
import BidonesCard from '../components/BidonesCard';
import IvaCard from '../components/IvaCard';
import CostosCard from '../components/CostosCard';
import UtilidadesCard from '../components/UtilidadesCard';
import InsightsPanel from '../components/InsightsPanel';
import TiltCard from '../components/TiltCard';
import { getKpis, getPedidos, getVentasHistoricas, getVentasTotalesHistoricas } from '../services/api';
import './Home.css';

export default function Home() {
  const theme = useTheme();
  
  const [data, setData] = useState({
    ventas: 0,
    ventasTotalesHistoricas: 0,
    pedidos: 0,
    clientes: 0,
    eficiencia: 0,
    capacidad: 0,
    litros: 0,
    ventasMensuales: 0,
    ventasSemanales: 0,
    ventasDiarias: 0,
    bidones: 0,
    iva: 0,
    costos: 0,
    utilidades: 0,
    meta: 0,
    ticketPromedio: 0,
    clientesActivos: 0,
    pedidosMes: 0,
    clientesInactivos: 0,
    ventasMesPasado: 0,
    pedidosMesPasado: 0,
    capacidadUtilizada: 0,
    litrosVendidos: 0,
    capacidadTotal: 30000,
    ventasHistoricas: [],
    costosMesPasado: 0,
    bidonesMesPasado: 0,
    ivaMesPasado: 0,
    utilidadesMesPasado: 0,
    ticketPromedioMesPasado: 0,
    clientesActivosMesPasado: 0,
    clientesInactivosMesPasado: 0,
    porcentajeCambioProyectado: 0,
    esPositivoProyectado: false,
    tendenciaTicket: [],
    tendenciaPedidos: [],
    tendenciaClientesActivos: [],
    tendenciaClientesInactivos: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Función para calcular porcentajes de cambio
  const calcularPorcentajeCambio = (actual, anterior) => {
    if (anterior === 0) return actual > 0 ? 100 : 0;
    return ((actual - anterior) / anterior) * 100;
  };

  // Crecimiento del acumulado histórico: cuánto aportó el mes actual al total
  // acumulado desde el inicio (no una comparación mes contra mes, que no
  // tiene sentido para una cifra que solo crece).
  const calcularCrecimientoAcumulado = (ventasMes, totalHistorico) => {
    const totalAntesDeEsteMes = totalHistorico - ventasMes;
    if (totalAntesDeEsteMes <= 0) return ventasMes > 0 ? 100 : 0;
    return (ventasMes / totalAntesDeEsteMes) * 100;
  };

  // Función para calcular porcentaje de cambio proyectado al mismo día
  const calcularPorcentajeCambioProyectado = (actual, anterior, diasActuales, diasAnterior) => {
    if (anterior === 0) return actual > 0 ? 100 : 0;
    
    // Proyectar el mes anterior al mismo número de días
    const anteriorProyectado = (anterior / diasAnterior) * diasActuales;
    
    return ((actual - anteriorProyectado) / anteriorProyectado) * 100;
  };

  // Función para calcular ticket promedio
  const calcularTicketPromedio = (ventas, pedidos) => {
    if (pedidos === 0) return 0;
    return Math.round(ventas / pedidos);
  };

  // Función para calcular ventas semanales (aproximación)
  const calcularVentasSemanales = (ventasMensuales) => {
    return Math.round(ventasMensuales / 4); // Aproximación semanal
  };

  // Función para calcular ventas diarias (aproximación)
  const calcularVentasDiarias = (ventasMensuales) => {
    return Math.round(ventasMensuales / 30); // Aproximación diaria
  };

  // Función para calcular meta (basada en ventas del mes anterior + 10%)
  const calcularMeta = (ventasMesPasado) => {
    return Math.round(ventasMesPasado * 1.1);
  };

  // Función para calcular progreso de meta
  const calcularProgresoMeta = (ventasActuales, meta) => {
    if (meta === 0) return 0;
    return Math.min(100, Math.round((ventasActuales / meta) * 100));
  };

  // Función para calcular porcentaje de capacidad utilizada
  const calcularPorcentajeCapacidad = (utilizada, total) => {
    if (total === 0) return 0;
    return Math.min(100, Math.round((utilizada / total) * 100));
  };

  // Función para parsear fecha en formato DD-MM-YYYY
  const parsearFechaPedido = (fechaStr) => {
    if (!fechaStr) return null;
    const partes = fechaStr.split('-');
    if (partes.length === 3) {
      return new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
    }
    return null;
  };

  // Calcula tendencias reales de los últimos 14 días para ticket promedio,
  // pedidos y clientes activos/inactivos (mismo criterio de 75 días que el backend)
  const calcularTendencias14Dias = (pedidos) => {
    const DIAS = 14;
    const VENTANA_ACTIVOS_DIAS = 75;
    const hoy = new Date();

    const pedidosConFecha = pedidos
      .map(p => ({ ...p, _fecha: parsearFechaPedido(p.fecha) }))
      .filter(p => p._fecha);

    const ticket = [];
    const pedidosPorDia = [];
    const activos = [];
    const inactivos = [];

    for (let i = DIAS - 1; i >= 0; i--) {
      const finDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i, 23, 59, 59, 999);
      const inicioDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i, 0, 0, 0, 0);

      const delDia = pedidosConFecha.filter(p => p._fecha >= inicioDia && p._fecha <= finDia);
      const ventasDelDia = delDia.reduce((s, p) => s + (parseInt(p.precio) || 0), 0);
      ticket.push(delDia.length > 0 ? Math.round(ventasDelDia / delDia.length) : 0);
      pedidosPorDia.push(delDia.length);

      const hastaEsteDia = pedidosConFecha.filter(p => p._fecha <= finDia);
      const corte = new Date(finDia);
      corte.setDate(corte.getDate() - VENTANA_ACTIVOS_DIAS);
      const activosSet = new Set(
        pedidosConFecha.filter(p => p._fecha > corte && p._fecha <= finDia).map(p => p.usuario)
      );
      const historicosSet = new Set(hastaEsteDia.map(p => p.usuario));
      activos.push(activosSet.size);
      inactivos.push(Math.max(0, historicosSet.size - activosSet.size));
    }

    return { ticket, pedidosPorDia, activos, inactivos };
  };

  const fetchData = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const kpisData = await getKpis();
      
      // Mostrar datos principales inmediatamente si es carga inicial
      if (isInitialLoad && kpisData) {
        // Calcular y mostrar datos básicos con solo KPIs
        const ventasSemanales = calcularVentasSemanales(kpisData.ventas_mes || 0);
        const ventasDiarias = Math.round((kpisData.ventas_mes || 0) / 30);
        const meta = calcularMeta(kpisData.ventas_mes_pasado || 0);
        const progresoMeta = calcularProgresoMeta(kpisData.ventas_mes || 0, meta);
        const ticketPromedio = calcularTicketPromedio(kpisData.ventas_mes || 0, kpisData.total_pedidos_mes || 0);
        const litrosVendidos = kpisData.litros_vendidos || 0;
        const capacidadTotal = kpisData.capacidad_total || 30000;
        const porcentajeCapacidad = calcularPorcentajeCapacidad(litrosVendidos, capacidadTotal);
        const bidonesMesPasado = Math.round((kpisData.litros_vendidos_mes_pasado || 0) / 20);
        const costosMesPasado = kpisData.costos_reales_mes_pasado || 0;
        const clientesInactivos = kpisData.clientes_inactivos || 0;
        
        const hoy = new Date();
        const diasActuales = hoy.getDate();
        const diasAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
        const pedidosMesPasadoProyectado = (kpisData.total_pedidos_mes_pasado || 0) / diasAnterior * diasActuales;
        const porcentajeCambioProyectado = calcularPorcentajeCambioProyectado(
          kpisData.total_pedidos_mes || 0,
          kpisData.total_pedidos_mes_pasado || 0,
          diasActuales,
          diasAnterior
        );
        
        // Actualizar estado con datos básicos para mostrar contenido rápidamente
        setData(prev => ({
          ...prev,
          ventas: kpisData.ventas_mes || 0,
          pedidos: kpisData.total_pedidos_mes || 0,
          clientes: kpisData.clientes_activos || 0,
          litros: litrosVendidos,
          ventasMensuales: kpisData.ventas_mes || 0,
          ventasSemanales: ventasSemanales,
          ventasDiarias: ventasDiarias,
          bidones: Math.round((kpisData.total_litros_mes || 0) / 20),
          iva: kpisData.iva || 0,
          costos: kpisData.costos_reales || 0,
          costosMesPasado: costosMesPasado,
          utilidades: kpisData.utilidad || 0,
          meta: progresoMeta,
          ticketPromedio: ticketPromedio,
          clientesActivos: kpisData.clientes_activos || 0,
          pedidosMes: kpisData.total_pedidos_mes || 0,
          clientesInactivos: clientesInactivos,
          ventasMesPasado: kpisData.ventas_mes_pasado || 0,
          pedidosMesPasado: kpisData.total_pedidos_mes_pasado || 0,
          capacidadUtilizada: porcentajeCapacidad,
          litrosVendidos: litrosVendidos,
          capacidadTotal: capacidadTotal,
          bidonesMesPasado: bidonesMesPasado,
          ivaMesPasado: kpisData.iva_mes_pasado || 0,
          utilidadesMesPasado: kpisData.utilidad_mes_pasado || 0,
          ticketPromedioMesPasado: kpisData.ticket_promedio_mes_pasado || 0,
          clientesActivosMesPasado: kpisData.clientes_activos_mes_pasado || 0,
          clientesInactivosMesPasado: kpisData.clientes_inactivos_mes_pasado || 0,
          porcentajeCambioProyectado: porcentajeCambioProyectado,
          esPositivoProyectado: (kpisData.total_pedidos_mes || 0) >= pedidosMesPasadoProyectado
        }));
        
        // Ocultar loading después de mostrar datos básicos
        setLoading(false);
      }

      const [pedidosData, ventasHistoricas, ventasTotalesHistoricas] = await Promise.all([
        getPedidos().catch(() => []),
        getVentasHistoricas().catch(() => []),
        getVentasTotalesHistoricas().catch(() => ({ ventas_totales: 0 }))
      ]);

      const tendencias14d = calcularTendencias14Dias(pedidosData);

      // CALCULAR VENTAS DE HOY - VERSIÓN SIMPLIFICADA
      const fechaActual = new Date();
      const dia = fechaActual.getDate().toString().padStart(2, '0');
      const mes = (fechaActual.getMonth() + 1).toString().padStart(2, '0');
      const anio = fechaActual.getFullYear();
      const fechaHoy = `${dia}-${mes}-${anio}`;
      
      let ventasHoy = 0;
      
      // Buscar pedidos de hoy
      pedidosData.forEach(pedido => {
        if (pedido.fecha === fechaHoy && pedido.nombrelocal === 'Aguas Ancud') {
          ventasHoy += parseInt(pedido.precio) || 0;
        }
      });
      
      // Si no encuentra pedidos de hoy, usar aproximación
      if (ventasHoy === 0) {
        ventasHoy = Math.round(kpisData.ventas_mes / 30);
      }
      
      // Calcular datos derivados
      const ventasSemanales = calcularVentasSemanales(kpisData.ventas_mes);
      const ventasDiarias = ventasHoy; // Usar ventas reales de hoy
      const meta = calcularMeta(kpisData.ventas_mes_pasado);
      const progresoMeta = calcularProgresoMeta(kpisData.ventas_mes, meta);
      const ticketPromedio = calcularTicketPromedio(kpisData.ventas_mes, kpisData.total_pedidos_mes);
      
      // Costos del mes pasado: dato real del backend
      const bidonesMesPasado = Math.round((kpisData.litros_vendidos_mes_pasado || 0) / 20);
      const costosMesPasado = kpisData.costos_reales_mes_pasado || 0;

      // Clientes inactivos: dato real del backend (no compraron en los últimos 75 días pero sí antes)
      const clientesInactivos = kpisData.clientes_inactivos || 0;

      // Calcular porcentaje de capacidad utilizada basado en litros vendidos
      const litrosVendidos = kpisData.litros_vendidos || 0;
      const capacidadTotal = kpisData.capacidad_total || 30000; // Dato real del backend, con fallback
      const porcentajeCapacidad = calcularPorcentajeCapacidad(litrosVendidos, capacidadTotal);
      
      // Calcular bidones vendidos (cada bidón = 20 litros)
      const bidonesVendidos = Math.round(litrosVendidos / 20);

      // Calcular días transcurridos en el mes actual
      const hoy = new Date();
      const diasActuales = hoy.getDate();
      const diasAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate(); // Días del mes anterior
      
      // Calcular proyección para pedidos del mes
      const pedidosMesPasadoProyectado = (kpisData.total_pedidos_mes_pasado || 0) / diasAnterior * diasActuales;
      const porcentajeCambioProyectado = calcularPorcentajeCambioProyectado(
        kpisData.total_pedidos_mes || 0, 
        kpisData.total_pedidos_mes_pasado || 0, 
        diasActuales, 
        diasAnterior
      );
      

      // Actualizar estado con datos completos (incluyendo pedidos y gráficos)
      // Si es carga inicial, ya actualizamos antes, solo agregamos campos adicionales
      setData(prev => ({
        ...prev,
        ventasTotalesHistoricas: ventasTotalesHistoricas.ventas_totales || prev.ventasTotalesHistoricas || 0,
        pedidos: kpisData.total_pedidos_mes || 0,
        clientes: kpisData.clientes_activos || 0,
        eficiencia: 94.2,
        capacidad: kpisData.capacidad_utilizada || 0,
        litros: kpisData.litros_vendidos || 0,
        ventasMensuales: kpisData.ventas_mes || 0,
        ventasSemanales: ventasSemanales,
        ventasDiarias: ventasDiarias,
        ventasDiariasMesPasado: Math.round(kpisData.ventas_mes_pasado / 30),
        bidones: Math.round((kpisData.total_litros_mes || 0) / 20),
        iva: kpisData.iva || 0,
        costos: kpisData.costos_reales || 0,
        costosMesPasado: costosMesPasado,
        utilidades: kpisData.utilidad || 0,
        meta: progresoMeta,
        ticketPromedio: ticketPromedio,
        clientesActivos: kpisData.clientes_activos || 0,
        pedidosMes: kpisData.total_pedidos_mes || 0,
        clientesInactivos: clientesInactivos,
        ventasMesPasado: kpisData.ventas_mes_pasado || 0,
        pedidosMesPasado: kpisData.total_pedidos_mes_pasado || 0,
        capacidadUtilizada: porcentajeCapacidad,
        litrosVendidos: litrosVendidos,
        capacidadTotal: capacidadTotal,
        ventasHistoricas: ventasHistoricas.length > 0 ? ventasHistoricas : prev.ventasHistoricas || [],
        tendenciaTicket: tendencias14d.ticket,
        tendenciaPedidos: tendencias14d.pedidosPorDia,
        tendenciaClientesActivos: tendencias14d.activos,
        tendenciaClientesInactivos: tendencias14d.inactivos,
        bidonesMesPasado: bidonesMesPasado,
        ivaMesPasado: kpisData.iva_mes_pasado || 0,
        utilidadesMesPasado: kpisData.utilidad_mes_pasado || 0,
        ticketPromedioMesPasado: kpisData.ticket_promedio_mes_pasado || 0,
        clientesActivosMesPasado: kpisData.clientes_activos_mes_pasado || 0,
        clientesInactivosMesPasado: kpisData.clientes_inactivos_mes_pasado || 0,
        porcentajeCambioProyectado: porcentajeCambioProyectado,
        esPositivoProyectado: (kpisData.total_pedidos_mes || 0) >= pedidosMesPasadoProyectado
      }));


    } catch (err) {
      setError('Error al cargar los datos del dashboard');
      setLoading(false);
      setIsRefreshing(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Función para actualización manual
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData(false); // Actualización manual sin loading inicial
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchData(true);

    const interval = setInterval(() => fetchData(false), 5 * 60 * 1000);
    const handleGlobalRefresh = () => fetchData(false);
    window.addEventListener('globalRefresh', handleGlobalRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('globalRefresh', handleGlobalRefresh);
    };
  }, []);




  // Colores de acento por métrica (coinciden con los usados dentro de cada card
  // para que el glow 3D de TiltCard combine con el color real del gráfico)
  const ACCENT = {
    ventasTotales: '#22d3ee',
    ventasMensuales: '#06b6d4',
    ventasSemanales: '#06b6d4',
    ventasDiarias: '#06b6d4',
    bidones: '#0ea5e9',
    iva: '#f59e0b',
    costos: '#ef4444',
    utilidades: '#10b981',
    kpiMeta: '#06b6d4',
    capacidad: '#10b981',
    ventasHistoricas: '#06b6d4',
    pedidosPorHorario: '#3b82f6',
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 2.5, height: '100vh', bgcolor: 'background.default' }}>
        <Box sx={{
          width: 52, height: 52, borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(139,92,246,0.12))',
          border: '1px solid rgba(6,182,212,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 24px rgba(6,182,212,0.2)',
        }}>
          <CircularProgress size={28} thickness={3.5} sx={{ color: '#06b6d4' }} />
        </Box>
        <Typography variant="body2" sx={{
          color: 'text.secondary', fontWeight: 500, letterSpacing: '0.02em',
          fontFamily: '"DM Sans", system-ui, sans-serif',
        }}>
          Cargando dashboard...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 2, height: '100vh', bgcolor: 'background.default' }}>
        <Typography variant="h6" sx={{ color: 'error.main', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>{error}</Typography>
        <Button variant="outlined" onClick={() => fetchData(true)} sx={{ borderRadius: '12px', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>Reintentar</Button>
      </Box>
    );
  }

  return (
    <>
      {/* Header fijo — Deep Water Float */}
      <Box sx={{
        position: 'fixed',
        top: 0,
        left: { xs: 0, md: '240px' },
        right: 0,
        zIndex: 1000,
        background: theme.palette.mode === 'dark'
          ? 'rgba(4,10,20,0.90)'
          : 'rgba(237,242,248,0.92)',
        padding: { xs: '14px 20px', md: '18px 32px' },
        borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.065)' : 'rgba(0,0,0,0.06)'}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: theme.palette.mode === 'dark'
          ? '0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.3)'
          : '0 1px 0 rgba(0,0,0,0.03), 0 2px 16px rgba(0,0,0,0.04)',
        transition: 'all 0.3s ease',
      }}>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}>
          <Box>
            <Typography sx={{
              fontWeight: 800,
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              marginBottom: 0.4,
              fontSize: { xs: '1.5rem', md: '2rem' },
              lineHeight: 1.1,
              letterSpacing: '-0.035em',
              background: 'linear-gradient(135deg, #06b6d4 0%, #0d9488 55%, #06b6d4 100%)',
              backgroundSize: '240% auto',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'gradientShift 8s ease infinite',
              '@keyframes gradientShift': {
                '0%':   { backgroundPosition: '0% center' },
                '50%':  { backgroundPosition: '100% center' },
                '100%': { backgroundPosition: '0% center' },
              },
            }}>
              Dashboard Aguas Ancud
            </Typography>
            <Typography variant="body2" sx={{
              color: 'text.secondary',
              fontSize: '0.82rem',
              fontWeight: 500,
              lineHeight: 1.4,
              fontFamily: '"DM Sans", system-ui, sans-serif',
              letterSpacing: '0.005em',
            }}>
              Panel de control y métricas en tiempo real
            </Typography>
          </Box>

          <Button
            variant="outlined"
            onClick={handleRefresh}
            disabled={isRefreshing}
            sx={{
              mt: { xs: 0.5, md: 0 },
              color: 'primary.main',
              borderColor: theme.palette.mode === 'dark' ? 'rgba(6,182,212,0.4)' : 'rgba(8,145,178,0.45)',
              borderRadius: '12px',
              px: 2.5,
              py: 1,
              fontWeight: 700,
              fontSize: '0.82rem',
              letterSpacing: '0.01em',
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              background: theme.palette.mode === 'dark' ? 'rgba(6,182,212,0.07)' : 'rgba(8,145,178,0.06)',
              transition: 'all 0.32s cubic-bezier(0.34,1.56,0.64,1)',
              '&:hover': {
                borderColor: 'primary.main',
                background: theme.palette.mode === 'dark' ? 'rgba(6,182,212,0.15)' : 'rgba(8,145,178,0.12)',
                transform: 'translateY(-2px)',
                boxShadow: theme.palette.mode === 'dark'
                  ? '0 4px 16px rgba(6,182,212,0.22)'
                  : '0 4px 14px rgba(8,145,178,0.2)',
              },
              '&:disabled': { opacity: 0.6 },
            }}
          >
            {isRefreshing ? 'Actualizando...' : '↻ Actualizar'}
          </Button>
        </Box>
      </Box>

      {/* Contenedor principal mejorado */}
      <Box sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        paddingLeft: { xs: 2, md: 4 },
        paddingRight: { xs: 2, md: 4 },
        paddingBottom: { xs: 2, md: 4 },
        paddingTop: '220px', // Espacio para el header fijo mejorado
        position: 'relative',
        overflow: 'auto',
        height: '100vh',
        background: theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)'
          : 'linear-gradient(135deg, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.005) 100%)'
      }}>
        {/* Contenido principal — grid responsivo, ocupa el 100% del ancho disponible */}
        <Box sx={{
          width: '100%',
          maxWidth: '100%',
          margin: '0 auto',
          paddingBottom: '48px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}>
          {/* Fila 1: Ventas */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 3, alignItems: 'stretch' }}>
            <TiltCard className="dash-card" accent={ACCENT.ventasTotales}>
              <VentasCard
                title="Ventas Totales Históricas"
                value={data.ventasTotalesHistoricas}
                subtitle="Acumulado desde el inicio"
                percentageChange={calcularCrecimientoAcumulado(data.ventas, data.ventasTotalesHistoricas)}
                isPositive={data.ventas > 0}
                ventasHistoricas={data.ventasHistoricas}
              />
            </TiltCard>
            <TiltCard className="dash-card" accent={ACCENT.ventasMensuales}>
              <VentasMensualesCard
                value={data.ventasMensuales}
                percentageChange={calcularPorcentajeCambio(data.ventasMensuales, data.ventasMesPasado)}
                isPositive={data.ventasMensuales >= data.ventasMesPasado}
              />
            </TiltCard>
            <TiltCard className="dash-card" accent={ACCENT.ventasSemanales}>
              <VentasSemanalesCard
                value={data.ventasSemanales}
                percentageChange={calcularPorcentajeCambio(data.ventasSemanales, data.ventasMesPasado / 4)}
                isPositive={data.ventasSemanales >= data.ventasMesPasado / 4}
              />
            </TiltCard>
            <TiltCard className="dash-card" accent={ACCENT.ventasDiarias}>
              <VentasDiariasCard
                value={data.ventasDiarias}
                percentageChange={calcularPorcentajeCambio(data.ventasDiarias, data.ventasMesPasado / 30)}
                isPositive={data.ventasDiarias >= data.ventasMesPasado / 30}
              />
            </TiltCard>
          </Box>

          {/* Fila 2: Bidones / IVA / Costos / Utilidades */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 3, alignItems: 'stretch' }}>
            <TiltCard className="dash-card" accent={ACCENT.bidones}>
              <BidonesCard
                value={data.bidones}
                percentageChange={calcularPorcentajeCambio(data.bidones, data.bidonesMesPasado || 0)}
                isPositive={data.bidones >= (data.bidonesMesPasado || 0)}
              />
            </TiltCard>
            <TiltCard className="dash-card" accent={ACCENT.iva}>
              <IvaCard
                value={data.iva}
                percentageChange={calcularPorcentajeCambio(data.iva, data.ivaMesPasado || 0)}
                isPositive={data.iva >= (data.ivaMesPasado || 0)}
              />
            </TiltCard>
            <TiltCard className="dash-card" accent={ACCENT.costos}>
              <CostosCard
                value={data.costos}
                percentageChange={calcularPorcentajeCambio(data.costos, data.costosMesPasado || 0)}
                isPositive={data.costos <= (data.costosMesPasado || 0)}
              />
            </TiltCard>
            <TiltCard className="dash-card" accent={ACCENT.utilidades}>
              <UtilidadesCard
                value={data.utilidades}
                percentageChange={calcularPorcentajeCambio(data.utilidades, data.utilidadesMesPasado || 0)}
                isPositive={data.utilidades >= (data.utilidadesMesPasado || 0)}
              />
            </TiltCard>
          </Box>

          {/* Fila 3: Meta / Capacidad / KPIs compactos */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 3, alignItems: 'stretch' }}>
            <TiltCard className="dash-card" accent={ACCENT.kpiMeta}>
              <KpiMetaCard
                currentValue={data.ventasMensuales}
                targetValue={calcularMeta(data.ventasMesPasado)}
                percentage={data.meta}
                title="Meta de Ventas"
                subtitle="Objetivo Mensual"
                description="Progreso respecto a la meta establecida para este mes."
              />
            </TiltCard>
            <TiltCard className="dash-card" accent={ACCENT.capacidad}>
              <CapacidadCard
                value={data.capacidadUtilizada}
                maxValue={100}
                unit="%"
                title="Capacidad de Producción"
                subtitle="Litros vendidos este mes"
                litrosVendidos={data.litrosVendidos}
                capacidadTotal={data.capacidadTotal}
              />
            </TiltCard>
            <Box className="dash-card" sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: 1.5,
              minHeight: 320,
              padding: 1.5,
              background: theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.038)'
                : 'rgba(255,255,255,0.85)',
              borderRadius: '18px',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: theme.palette.mode === 'dark'
                ? '1px solid rgba(255,255,255,0.08)'
                : '1px solid rgba(0,0,0,0.07)',
              boxShadow: theme.palette.mode === 'dark'
                ? '0 2px 4px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.055)'
                : '0 2px 4px rgba(0,0,0,0.04), 0 8px 28px rgba(0,0,0,0.07)',
            }}>
              <FinancialKpiCard
                title="Ticket Promedio"
                value={data.ticketPromedio}
                subtitle="Por pedido"
                icon="💰"
                trend={`${calcularPorcentajeCambio(data.ticketPromedio, data.ticketPromedioMesPasado || 0).toFixed(1)}%`}
                isPositive={data.ticketPromedio >= (data.ticketPromedioMesPasado || 0)}
                trendData={data.tendenciaTicket}
              />
              <FinancialKpiCard
                title="Clientes Activos"
                value={data.clientesActivos}
                subtitle="Este mes"
                icon="👥"
                trend={`${calcularPorcentajeCambio(data.clientesActivos, data.clientesActivosMesPasado || 0).toFixed(1)}%`}
                isPositive={data.clientesActivos >= (data.clientesActivosMesPasado || 0)}
                trendData={data.tendenciaClientesActivos}
              />
              <FinancialKpiCard
                title="Pedidos del Mes"
                value={data.pedidosMes}
                subtitle="Total"
                icon="📦"
                trend={`${data.porcentajeCambioProyectado.toFixed(1)}%`}
                isPositive={data.esPositivoProyectado}
                trendData={data.tendenciaPedidos}
              />
              <FinancialKpiCard
                title="Clientes Inactivos"
                value={data.clientesInactivos}
                subtitle="Este mes"
                icon="⏸️"
                trend={`${calcularPorcentajeCambio(data.clientesInactivos, data.clientesInactivosMesPasado || 0).toFixed(1)}%`}
                isPositive={data.clientesInactivos <= (data.clientesInactivosMesPasado || 0)}
                trendData={data.tendenciaClientesInactivos}
              />
            </Box>
          </Box>

          {/* Fila 4: Gráficos */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3, alignItems: 'stretch' }}>
            <TiltCard className="dash-card" accent={ACCENT.ventasHistoricas} maxTilt={2}>
              <ChartCard
                title="Ventas Históricas"
                data={data.ventasHistoricas}
                type="bar"
              />
            </TiltCard>
            <TiltCard className="dash-card" accent={ACCENT.pedidosPorHorario}>
              <PedidosPorBloqueDonut
                title="Pedidos por Horario"
              />
            </TiltCard>
          </Box>

          {/* Fila 5: Operador Inteligente AI */}
          <Box>
            <InsightsPanel darkMode={theme.palette.mode === 'dark'} />
          </Box>
        </Box>
      </Box>
    </>
  );
}