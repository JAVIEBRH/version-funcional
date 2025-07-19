import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Button } from '@mui/material';
import KpiCard from '../components/KpiCard';
import FinancialKpiCard from '../components/FinancialKpiCard';
import ChartCard from '../components/ChartCard';
import CapacidadCard from '../components/CapacidadCard';
import LitrosCard from '../components/LitrosCard';
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
import DraggableCard from '../components/DraggableCard';
import RentabilidadCard from '../components/RentabilidadCard';
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
    ventasHistoricas: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Función para calcular porcentajes de cambio
  const calcularPorcentajeCambio = (actual, anterior) => {
    if (anterior === 0) return actual > 0 ? 100 : 0;
    return ((actual - anterior) / anterior) * 100;
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

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener datos de KPIs
      const kpisData = await getKpis();
      console.log('KPIs obtenidos:', kpisData);

      // Obtener pedidos para cálculos adicionales
      const pedidosData = await getPedidos();
      console.log('Pedidos obtenidos:', pedidosData);

      // Obtener ventas históricas para el gráfico
      const ventasHistoricas = await getVentasHistoricas();
      console.log('Ventas históricas obtenidas:', ventasHistoricas);

      // Obtener ventas totales históricas
      const ventasTotalesHistoricas = await getVentasTotalesHistoricas();
      console.log('Ventas totales históricas obtenidas:', ventasTotalesHistoricas);

      // Calcular datos derivados
      const ventasSemanales = calcularVentasSemanales(kpisData.ventas_mes);
      const ventasDiarias = calcularVentasDiarias(kpisData.ventas_mes);
      const meta = calcularMeta(kpisData.ventas_mes_pasado);
      const progresoMeta = calcularProgresoMeta(kpisData.ventas_mes, meta);
      const ticketPromedio = calcularTicketPromedio(kpisData.ventas_mes, kpisData.total_pedidos_mes);
      
      // Calcular clientes inactivos (aproximación)
      const clientesInactivos = Math.max(0, Math.round(kpisData.clientes_activos * 0.2));

      // Calcular porcentaje de capacidad utilizada basado en litros vendidos
      const litrosVendidos = kpisData.litros_vendidos || 0;
      const capacidadTotal = 30000; // Capacidad fija de 30,000 litros mensuales
      const porcentajeCapacidad = calcularPorcentajeCapacidad(litrosVendidos, capacidadTotal);
      
      // Calcular bidones vendidos (cada bidón = 20 litros)
      const bidonesVendidos = Math.round(litrosVendidos / 20);

      // Actualizar estado con datos reales
      setData({
        ventas: kpisData.ventas_mes || 0,
        ventasTotalesHistoricas: ventasTotalesHistoricas.ventas_totales || 0,
        pedidos: kpisData.total_pedidos_mes || 0,
        clientes: kpisData.clientes_activos || 0,
        eficiencia: 94.2, // Mantener valor fijo por ahora
        capacidad: kpisData.capacidad_utilizada || 0,
        litros: kpisData.litros_vendidos || 0,
        ventasMensuales: kpisData.ventas_mes || 0,
        ventasSemanales: ventasSemanales,
        ventasDiarias: ventasDiarias,
        bidones: Math.round((kpisData.litros_vendidos || 0) / 20), // 20 litros por bidón
        iva: kpisData.iva || 0,
        costos: kpisData.costos_reales || 0,
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
        ventasHistoricas: ventasHistoricas
      });

    } catch (err) {
      console.error('Error obteniendo datos:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Función para actualización manual
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchData();
    
    // Actualización automática cada 10 minutos
    const interval = setInterval(() => {
      console.log('Actualización automática de datos...');
      fetchData();
    }, 10 * 60 * 1000); // 10 minutos

    // Escuchar evento de actualización global
    const handleGlobalRefresh = () => {
      console.log('Actualización global detectada en Home...');
      fetchData();
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('globalRefresh', handleGlobalRefresh);
    };
  }, []);



  const initialPositions = {
    ventasTotales: { x: 20, y: 100 },
    ventasMensuales: { x: 360, y: 100 },
    ventasSemanales: { x: 700, y: 100 },
    ventasDiarias: { x: 1040, y: 100 },
    bidones: { x: 20, y: 340 },
    iva: { x: 360, y: 340 },
    costos: { x: 700, y: 340 },
    utilidades: { x: 1040, y: 340 },
    kpiMeta: { x: 20, y: 580 },
    capacidad: { x: 360, y: 580 },
    compactCards: { x: 700, y: 580 }
  };

  const initialSizes = {
    ventasTotales: { width: 320, height: 220 },
    ventasMensuales: { width: 320, height: 220 },
    ventasSemanales: { width: 320, height: 220 },
    ventasDiarias: { width: 320, height: 220 },
    bidones: { width: 320, height: 220 },
    iva: { width: 320, height: 220 },
    costos: { width: 320, height: 220 },
    utilidades: { width: 320, height: 220 },
    kpiMeta: { width: 320, height: 320 },
    capacidad: { width: 320, height: 320 },
    compactCards: { width: 640, height: 320 }
  };

  const [cardPositions, setCardPositions] = useState(initialPositions);
  const [cardSizes, setCardSizes] = useState(initialSizes);

  const handleCardMove = (id, position) => {
    setCardPositions(prev => ({
      ...prev,
      [id]: position
    }));
  };

  const handleCardResize = (id, size) => {
    setCardSizes(prev => ({
      ...prev,
      [id]: size
    }));
  };

  const resetLayout = () => {
    setCardPositions(initialPositions);
    setCardSizes(initialSizes);
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
        <Typography variant="h6" sx={{ color: 'text.primary' }}>
          Cargando dashboard...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        bgcolor: 'background.default'
      }}>
        <Typography variant="h6" sx={{ color: 'error.main' }}>
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      {/* Header fijo */}
      <Box sx={{ 
        position: 'fixed',
        top: 0,
        left: { xs: 0, md: '240px' }, // Ajustar para el sidebar en desktop
        right: 0,
        zIndex: 1000,
        bgcolor: 'background.default',
        padding: 3,
        borderBottom: `1px solid ${theme.palette.divider}`,
        boxShadow: theme.shadows[1],
        backdropFilter: 'blur(10px)',
        height: 'auto'
      }}>
        <Typography variant="h3" sx={{ 
          fontWeight: 700, 
          color: 'text.primary',
          marginBottom: 1
        }}>
          Dashboard Aguas Ancud
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Panel de control y métricas en tiempo real
        </Typography>
        
        <Button 
          variant="outlined" 
          onClick={resetLayout}
          sx={{ 
            mt: 2,
            color: 'primary.main',
            borderColor: 'primary.main',
            '&:hover': {
              borderColor: 'primary.dark',
              backgroundColor: 'primary.main',
              color: 'white'
            }
          }}
        >
          Resetear Layout
        </Button>
      </Box>

      {/* Contenedor principal con padding-top para el header */}
      <Box sx={{ 
        minHeight: '100vh',
        bgcolor: 'background.default',
        padding: 3,
        paddingTop: '200px', // Espacio para el header fijo
        position: 'relative',
        overflow: 'auto',
        height: '100vh' // Forzar altura completa
      }}>
        {/* Contenido principal */}
        <Box sx={{ 
          position: 'relative',
          minHeight: 'calc(100vh - 200px)',
          width: '100%',
          paddingBottom: '200px' // Espacio adicional al final
        }}>
          {/* Cards principales */}
          <DraggableCard
            id="ventasTotales"
            position={cardPositions.ventasTotales}
            size={cardSizes.ventasTotales}
            onMove={handleCardMove}
            onResize={handleCardResize}
          >
            <VentasCard 
              title="Ventas Totales Históricas"
              value={data.ventasTotalesHistoricas}
              subtitle="Acumulado desde el inicio"
              percentageChange={calcularPorcentajeCambio(data.ventas, data.ventasMesPasado)}
              isPositive={data.ventas >= data.ventasMesPasado}
            />
          </DraggableCard>

          <DraggableCard
            id="ventasMensuales"
            position={cardPositions.ventasMensuales}
            size={cardSizes.ventasMensuales}
            onMove={handleCardMove}
            onResize={handleCardResize}
          >
            <VentasMensualesCard 
              value={data.ventasMensuales}
              percentageChange={calcularPorcentajeCambio(data.ventasMensuales, data.ventasMesPasado)}
              isPositive={data.ventasMensuales >= data.ventasMesPasado}
            />
          </DraggableCard>

          <DraggableCard
            id="ventasSemanales"
            position={cardPositions.ventasSemanales}
            size={cardSizes.ventasSemanales}
            onMove={handleCardMove}
            onResize={handleCardResize}
          >
            <VentasSemanalesCard 
              value={data.ventasSemanales}
              percentageChange={calcularPorcentajeCambio(data.ventasSemanales, data.ventasMesPasado / 4)}
              isPositive={data.ventasSemanales >= data.ventasMesPasado / 4}
            />
          </DraggableCard>

          <DraggableCard
            id="ventasDiarias"
            position={cardPositions.ventasDiarias}
            size={cardSizes.ventasDiarias}
            onMove={handleCardMove}
            onResize={handleCardResize}
          >
            <VentasDiariasCard 
              value={data.ventasDiarias}
              percentageChange={calcularPorcentajeCambio(data.ventasDiarias, data.ventasMesPasado / 30)}
              isPositive={data.ventasDiarias >= data.ventasMesPasado / 30}
            />
          </DraggableCard>

          <DraggableCard
            id="bidones"
            position={cardPositions.bidones}
            size={cardSizes.bidones}
            onMove={handleCardMove}
            onResize={handleCardResize}
          >
            <BidonesCard 
              value={data.bidones}
              percentageChange={calcularPorcentajeCambio(data.bidones, Math.round(data.litrosVendidos / 20))}
              isPositive={data.bidones >= Math.round(data.litrosVendidos / 20)}
            />
          </DraggableCard>

          <DraggableCard
            id="iva"
            position={cardPositions.iva}
            size={cardSizes.iva}
            onMove={handleCardMove}
            onResize={handleCardResize}
          >
            <IvaCard 
              value={data.iva}
              percentageChange={calcularPorcentajeCambio(data.iva, data.ventasMesPasado * 0.19)}
              isPositive={data.iva >= data.ventasMesPasado * 0.19}
            />
          </DraggableCard>

          <DraggableCard
            id="costos"
            position={cardPositions.costos}
            size={cardSizes.costos}
            onMove={handleCardMove}
            onResize={handleCardResize}
          >
            <CostosCard 
              value={data.costos}
              percentageChange={calcularPorcentajeCambio(data.costos, data.ventasMesPasado * 0.7)}
              isPositive={data.costos <= data.ventasMesPasado * 0.7}
            />
          </DraggableCard>

          <DraggableCard
            id="utilidades"
            position={cardPositions.utilidades}
            size={cardSizes.utilidades}
            onMove={handleCardMove}
            onResize={handleCardResize}
          >
            <UtilidadesCard 
              value={data.utilidades}
              percentageChange={calcularPorcentajeCambio(data.utilidades, data.ventasMesPasado * 0.3)}
              isPositive={data.utilidades >= data.ventasMesPasado * 0.3}
            />
          </DraggableCard>

          <DraggableCard
            id="kpiMeta"
            position={cardPositions.kpiMeta}
            size={cardSizes.kpiMeta}
            onMove={handleCardMove}
            onResize={handleCardResize}
          >
            <KpiMetaCard 
              value={data.meta}
              title="Meta de Ventas"
              subtitle="Objetivo Mensual"
              description="Progreso respecto a la meta establecida para este mes."
            />
          </DraggableCard>

          <DraggableCard
            id="capacidad"
            position={cardPositions.capacidad}
            size={cardSizes.capacidad}
            onMove={handleCardMove}
            onResize={handleCardResize}
          >
            <CapacidadCard 
              value={data.capacidadUtilizada}
              maxValue={100}
              unit="%"
              title="Capacidad de Producción"
              subtitle="Litros vendidos este mes"
              litrosVendidos={data.litrosVendidos}
              capacidadTotal={data.capacidadTotal}
            />
          </DraggableCard>

          {/* Cards compactos - FIJOS */}
          <Box
            sx={{ 
              position: 'absolute',
              left: cardPositions.compactCards.x,
              top: cardPositions.compactCards.y,
              width: cardSizes.compactCards.width,
              height: cardSizes.compactCards.height,
              zIndex: 10
            }}
          >
            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: 1.5,
              height: '100%',
              padding: 2,
              bgcolor: 'background.paper',
              borderRadius: 1,
              boxShadow: theme.shadows[1],
              border: `1px solid ${theme.palette.divider}`
            }}>
              <FinancialKpiCard 
                title="Ticket Promedio"
                value={data.ticketPromedio}
                subtitle="Por pedido"
                icon="💰"
                trend="+5.2%"
                isPositive={true}
              />
              <KpiCard 
                title="Clientes Activos"
                value={data.clientesActivos}
                subtitle="Este mes"
                icon="👥"
                trend="+3.1%"
                isPositive={true}
              />
              <KpiCard 
                title="Pedidos del Mes"
                value={data.pedidosMes}
                subtitle="Total"
                icon="📦"
                trend="+8.7%"
                isPositive={true}
              />
              <KpiCard 
                title="Clientes Inactivos"
                value={data.clientesInactivos}
                subtitle="Este mes"
                icon="⏸️"
                trend="-2.3%"
                isPositive={false}
              />
            </Box>
          </Box>

          {/* GRÁFICOS SIEMPRE AL FINAL - FUERA DEL FLUJO NORMAL */}
          <Box sx={{ 
            position: 'absolute',
            top: '1000px', // Reducir espacio - posición más cercana a los cards
            left: 0,
            right: 0,
            display: 'flex', 
            gap: 3, 
            justifyContent: 'flex-start',
            zIndex: 1 // Asegurar que estén por encima del fondo
          }}>
            <Box sx={{ flex: 2 }}>
              <ChartCard 
                title="Ventas Históricas"
                data={data.ventasHistoricas}
                type="bar"
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <PedidosPorBloqueDonut 
                title="Pedidos por Horario"
              />
            </Box>
          </Box>

          {/* ANÁLISIS DE RENTABILIDAD - ABAJO DE LOS GRÁFICOS */}
          <Box sx={{ 
            position: 'absolute',
            top: '1400px', // Posición ABAJO de los gráficos
            left: 0,
            right: 0,
            zIndex: 1
          }}>
            <RentabilidadCard />
          </Box>
        </Box>
      </Box>
    </>
  );
}