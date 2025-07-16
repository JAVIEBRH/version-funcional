import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Chip,
  IconButton,
  Collapse
} from '@mui/material';
import { 
  TrendingUp, 
  CalendarMonth, 
  BarChart,
  PieChart,
  ExpandMore,
  ExpandLess,
  History,
  CheckCircle,
  Warning,
  Info,
  Delete
} from '@mui/icons-material';
import { getFactoresPrediccion } from '../services/api';
import PrediccionCumplimientoCard from '../components/PrediccionCumplimientoCard';
import './Predictor.css';

export default function Predictor() {
  const [prediccion, setPrediccion] = useState({
    fecha: '',
    tipoCliente: '',
    historico: '30'
  });
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [factoresReales, setFactoresReales] = useState(null);
  const [datosHistoricos, setDatosHistoricos] = useState([]);
  const [cumplimiento, setCumplimiento] = useState({
    prediccionEsperada: 0,
    pedidosReales: 0,
    fecha: '',
    tipoCliente: ''
  });
  const [historialPredicciones, setHistorialPredicciones] = useState([]);
  const [expandedHistorial, setExpandedHistorial] = useState({});

  // Cargar factores reales al montar el componente
  useEffect(() => {
    cargarFactoresReales();
    cargarDatosHistoricos();
    cargarHistorialLocal();
    
    // Actualización automática cada 10 minutos
    const interval = setInterval(() => {
      console.log('Actualización automática del predictor...');
      cargarFactoresReales();
      cargarDatosHistoricos();
    }, 10 * 60 * 1000); // 10 minutos

    // Escuchar evento de actualización global
    const handleGlobalRefresh = () => {
      console.log('Actualización global detectada en Predictor...');
      cargarFactoresReales();
      cargarDatosHistoricos();
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('globalRefresh', handleGlobalRefresh);
    };
  }, []);

  const cargarHistorialLocal = () => {
    try {
      const historialGuardado = localStorage.getItem('historialPredicciones');
      if (historialGuardado) {
        setHistorialPredicciones(JSON.parse(historialGuardado));
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
    }
  };

  const guardarHistorialLocal = (nuevoHistorial) => {
    try {
      localStorage.setItem('historialPredicciones', JSON.stringify(nuevoHistorial));
    } catch (error) {
      console.error('Error guardando historial:', error);
    }
  };

  const generarAnalisisAutomatico = (resultado, prediccion) => {
    // Corregir el formato de fecha para evitar problemas de zona horaria
    const fecha = new Date(prediccion.fecha + 'T00:00:00');
    const diaSemana = fecha.getDay();
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    let analisis = {
      titulo: `Predicción del ${fecha.toLocaleDateString('es-ES')} - ${prediccion.tipoCliente}`,
      fecha: prediccion.fecha,
      tipoCliente: prediccion.tipoCliente,
      timestamp: new Date().toISOString(),
      resumen: '',
      detalles: [],
      nivelConfianza: resultado.confianza,
      totalPedidos: resultado.totalPedidos,
      zonasActivas: Object.entries(resultado.prediccionesPorZona)
        .filter(([_, datos]) => datos.pedidos > 0)
        .map(([zona, _]) => zona),
      zonasInactivas: Object.entries(resultado.prediccionesPorZona)
        .filter(([_, datos]) => datos.pedidos === 0)
        .map(([zona, _]) => zona)
    };

    // Generar resumen principal con fecha corregida
    analisis.resumen = `Se esperan ${resultado.totalPedidos} pedidos para el ${diasSemana[diaSemana]} ${fecha.toLocaleDateString('es-ES')} con ${resultado.confianza}% de confianza.`;
    
    // Log para verificar la fecha procesada
    console.log('=== ANÁLISIS AUTOMÁTICO ===');
    console.log('Fecha ingresada:', prediccion.fecha);
    console.log('Fecha procesada:', fecha.toLocaleDateString('es-ES'));
    console.log('Día de la semana:', diasSemana[diaSemana], `(${diaSemana})`);
    console.log('Resumen generado:', analisis.resumen);
    console.log('=============================');

    // Análisis detallado
    const detalles = [];

    // Análisis por día de la semana
    if (diaSemana === 0 || diaSemana === 6) {
      detalles.push({
        tipo: 'info',
        mensaje: `Día ${diasSemana[diaSemana]}: Demanda típicamente menor en fines de semana`,
        icono: 'info'
      });
    } else if (diaSemana >= 1 && diaSemana <= 5) {
      detalles.push({
        tipo: 'success',
        mensaje: `Día ${diasSemana[diaSemana]}: Alta actividad comercial esperada`,
        icono: 'check'
      });
    }

    // Análisis por tipo de cliente
    if (prediccion.tipoCliente === 'recurrente') {
      detalles.push({
        tipo: 'success',
        mensaje: 'Clientes recurrentes: Demanda estable y predecible',
        icono: 'check'
      });
    } else if (prediccion.tipoCliente === 'nuevo') {
      detalles.push({
        tipo: 'warning',
        mensaje: 'Clientes nuevos: Mayor variabilidad en la demanda',
        icono: 'warning'
      });
    } else if (prediccion.tipoCliente === 'empresa') {
      detalles.push({
        tipo: 'info',
        mensaje: 'Clientes empresariales: Pedidos de mayor volumen',
        icono: 'info'
      });
    }

    // Análisis por volumen total
    if (resultado.totalPedidos > 50) {
      detalles.push({
        tipo: 'success',
        mensaje: `Alto volumen (${resultado.totalPedidos} pedidos): Considerar refuerzo de personal`,
        icono: 'check'
      });
    } else if (resultado.totalPedidos < 20) {
      detalles.push({
        tipo: 'warning',
        mensaje: `Bajo volumen (${resultado.totalPedidos} pedidos): Evaluar optimización de rutas`,
        icono: 'warning'
      });
    } else {
      detalles.push({
        tipo: 'info',
        mensaje: `Volumen moderado (${resultado.totalPedidos} pedidos): Operación estándar`,
        icono: 'info'
      });
    }

    // Análisis por distribución de zonas
    if (analisis.zonasActivas.length >= 4) {
      detalles.push({
        tipo: 'success',
        mensaje: `Buena distribución: Actividad en ${analisis.zonasActivas.length} zonas`,
        icono: 'check'
      });
    } else if (analisis.zonasActivas.length <= 2) {
      detalles.push({
        tipo: 'warning',
        mensaje: `Concentración alta: Solo ${analisis.zonasActivas.length} zonas activas`,
        icono: 'warning'
      });
    }

    // Análisis de confianza
    if (resultado.confianza >= 90) {
      detalles.push({
        tipo: 'success',
        mensaje: `Alta confianza (${resultado.confianza}%): Predicción muy confiable`,
        icono: 'check'
      });
    } else if (resultado.confianza >= 75) {
      detalles.push({
        tipo: 'info',
        mensaje: `Confianza moderada (${resultado.confianza}%): Considerar factores adicionales`,
        icono: 'info'
      });
    } else {
      detalles.push({
        tipo: 'warning',
        mensaje: `Baja confianza (${resultado.confianza}%): Revisar datos históricos`,
        icono: 'warning'
      });
    }

    // Análisis de factores considerados
    if (resultado.factores.length > 0) {
      detalles.push({
        tipo: 'info',
        mensaje: `Factores clave: ${resultado.factores.join(', ')}`,
        icono: 'info'
      });
    }

    // Análisis de recomendaciones
    if (resultado.recomendaciones.length > 0) {
      detalles.push({
        tipo: 'success',
        mensaje: `Recomendaciones: ${resultado.recomendaciones.join(', ')}`,
        icono: 'check'
      });
    }

    analisis.detalles = detalles;
    return analisis;
  };

  const cargarFactoresReales = async () => {
    try {
      const factores = await getFactoresPrediccion();
      setFactoresReales(factores);
      console.log('Factores reales cargados:', factores);
    } catch (error) {
      console.error('Error cargando factores reales:', error);
    }
  };

  const cargarDatosHistoricos = async () => {
    try {
      // Simulación de datos históricos reales de Aguas Ancud
      const historico = [
        { fecha: '2024-01-15', pedidos: 45, zona: 'centro', tipo: 'recurrente', temperatura: 28 },
        { fecha: '2024-01-16', pedidos: 52, zona: 'norte', tipo: 'empresa', temperatura: 30 },
        { fecha: '2024-01-17', pedidos: 38, zona: 'sur', tipo: 'residencial', temperatura: 25 },
        { fecha: '2024-01-18', pedidos: 61, zona: 'centro', tipo: 'recurrente', temperatura: 32 },
        { fecha: '2024-01-19', pedidos: 48, zona: 'este', tipo: 'nuevo', temperatura: 29 },
        { fecha: '2024-01-20', pedidos: 55, zona: 'oeste', tipo: 'empresa', temperatura: 31 },
        { fecha: '2024-01-21', pedidos: 42, zona: 'centro', tipo: 'residencial', temperatura: 27 },
        { fecha: '2024-01-22', pedidos: 58, zona: 'norte', tipo: 'recurrente', temperatura: 33 },
        { fecha: '2024-01-23', pedidos: 49, zona: 'sur', tipo: 'empresa', temperatura: 26 },
        { fecha: '2024-01-24', pedidos: 63, zona: 'centro', tipo: 'nuevo', temperatura: 34 },
        { fecha: '2024-01-25', pedidos: 51, zona: 'este', tipo: 'recurrente', temperatura: 28 },
        { fecha: '2024-01-26', pedidos: 56, zona: 'oeste', tipo: 'residencial', temperatura: 30 },
        { fecha: '2024-01-27', pedidos: 44, zona: 'norte', tipo: 'empresa', temperatura: 25 },
        { fecha: '2024-01-28', pedidos: 59, zona: 'centro', tipo: 'recurrente', temperatura: 32 },
        { fecha: '2024-01-29', pedidos: 47, zona: 'sur', tipo: 'nuevo', temperatura: 27 },
        { fecha: '2024-01-30', pedidos: 62, zona: 'este', tipo: 'empresa', temperatura: 33 },
        { fecha: '2024-01-31', pedidos: 53, zona: 'oeste', tipo: 'residencial', temperatura: 29 },
        { fecha: '2024-02-01', pedidos: 48, zona: 'centro', tipo: 'recurrente', temperatura: 26 },
        { fecha: '2024-02-02', pedidos: 55, zona: 'norte', tipo: 'empresa', temperatura: 31 },
        { fecha: '2024-02-03', pedidos: 41, zona: 'sur', tipo: 'nuevo', temperatura: 24 },
        { fecha: '2024-02-04', pedidos: 57, zona: 'este', tipo: 'residencial', temperatura: 30 },
        { fecha: '2024-02-05', pedidos: 50, zona: 'oeste', tipo: 'recurrente', temperatura: 28 },
        { fecha: '2024-02-06', pedidos: 64, zona: 'centro', tipo: 'empresa', temperatura: 34 },
        { fecha: '2024-02-07', pedidos: 46, zona: 'norte', tipo: 'nuevo', temperatura: 25 },
        { fecha: '2024-02-08', pedidos: 58, zona: 'sur', tipo: 'residencial', temperatura: 32 },
        { fecha: '2024-02-09', pedidos: 52, zona: 'este', tipo: 'recurrente', temperatura: 29 },
        { fecha: '2024-02-10', pedidos: 61, zona: 'oeste', tipo: 'empresa', temperatura: 33 },
        { fecha: '2024-02-11', pedidos: 43, zona: 'centro', tipo: 'nuevo', temperatura: 26 },
        { fecha: '2024-02-12', pedidos: 56, zona: 'norte', tipo: 'residencial', temperatura: 31 },
        { fecha: '2024-02-13', pedidos: 49, zona: 'sur', tipo: 'recurrente', temperatura: 27 },
        { fecha: '2024-02-14', pedidos: 63, zona: 'este', tipo: 'empresa', temperatura: 34 }
      ];
      setDatosHistoricos(historico);
    } catch (error) {
      console.error('Error cargando datos históricos:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPrediccion(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const toggleHistorial = (index) => {
    setExpandedHistorial(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const eliminarPrediccion = (index) => {
    const nuevoHistorial = historialPredicciones.filter((_, i) => i !== index);
    setHistorialPredicciones(nuevoHistorial);
    guardarHistorialLocal(nuevoHistorial);
    
    // Limpiar el estado de expansión para el elemento eliminado
    setExpandedHistorial(prev => {
      const nuevoExpanded = { ...prev };
      delete nuevoExpanded[index];
      // Reindexar los elementos restantes
      const reindexed = {};
      Object.keys(nuevoExpanded).forEach(key => {
        const oldIndex = parseInt(key);
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = nuevoExpanded[oldIndex];
        } else {
          reindexed[oldIndex] = nuevoExpanded[oldIndex];
        }
      });
      return reindexed;
    });
  };

  // Lógica de forecast para todas las zonas
  const calcularForecastCompleto = () => {
    if (!prediccion.fecha || !prediccion.tipoCliente || !factoresReales) {
      return null;
    }

    // Corregir el formato de fecha para evitar problemas de zona horaria
    const fechaObjetivo = new Date(prediccion.fecha + 'T00:00:00');
    const diaSemana = fechaObjetivo.getDay(); // 0 = domingo, 1 = lunes, etc.
    const mes = fechaObjetivo.getMonth(); // 0 = enero, 1 = febrero, etc.

    // Usar factores reales del backend
    const {
      factores_temporada,
      factores_zona,
      factores_tipo_cliente,
      factores_dia_semana,
      crecimiento_mensual,
      promedio_pedidos_mensual
    } = factoresReales;

    // 1. FACTOR BASE: Usar solo datos reales del backend
    const promedioBase = promedio_pedidos_mensual / 30;

    // 2. FACTOR ESTACIONAL: Patrones reales por día de la semana
    const factorDia = factores_dia_semana[diaSemana] || 1.0;

    // 3. FACTOR TEMPORADA: Patrones reales por mes
    const factorTemporada = factores_temporada[mes] || 1.0;

    // 4. FACTOR TIPO CLIENTE: Patrones reales por tipo
    const factorTipo = factores_tipo_cliente[prediccion.tipoCliente] || 1.0;

    // 5. FACTOR TENDENCIA: Crecimiento real mensual (ajustado para ser más conservador)
    const tendencia = Math.min(crecimiento_mensual, 1.15); // Máximo 15% de crecimiento

    // 6. FACTOR ALEATORIO: Variabilidad natural (reducido)
    const factorAleatorio = 0.95 + Math.random() * 0.1; // ±5% en lugar de ±10%

    // LOGS DETALLADOS PARA DEBUG
    console.log('=== CÁLCULO DETALLADO DE PREDICCIÓN COMPLETA ===');
    console.log('Fecha ingresada:', prediccion.fecha);
    console.log('Fecha procesada:', fechaObjetivo.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }));
    console.log('Día semana:', diaSemana, '(0=domingo, 1=lunes...)');
    console.log('Mes:', mes, '(0=enero, 1=febrero...)');
    console.log('Tipo cliente:', prediccion.tipoCliente);

    // Calcular predicción para cada zona
    const zonas = ['centro', 'norte', 'sur', 'este', 'oeste'];
    const prediccionesPorZona = {};

    zonas.forEach(zona => {
      const factorZona = factores_zona[zona] || 1.0;
      
      const prediccionCalculada = Math.round(
        promedioBase * 
        factorDia * 
        factorTemporada * 
        factorZona * 
        factorTipo * 
        tendencia * 
        factorAleatorio
      );

      prediccionesPorZona[zona] = {
        pedidos: prediccionCalculada,
        factorZona: factorZona,
        porcentaje: 0 // Se calculará después
      };
    });

    // Calcular total y porcentajes
    const totalPedidos = Object.values(prediccionesPorZona).reduce((sum, zona) => sum + zona.pedidos, 0);
    
    zonas.forEach(zona => {
      prediccionesPorZona[zona].porcentaje = totalPedidos > 0 ? 
        Math.round((prediccionesPorZona[zona].pedidos / totalPedidos) * 100) : 0;
    });

    console.log('PREDICCIONES POR ZONA:', prediccionesPorZona);
    console.log('TOTAL PEDIDOS:', totalPedidos);
    console.log('=====================================');

    // Calcular confianza basada en la cantidad de datos históricos
    const confianza = Math.min(95, 70 + (factoresReales.total_pedidos_analizados / 20));

    // Generar factores considerados basados en datos reales
    const factores = [];
    if (factorDia > 1.1) factores.push('Día de alta demanda');
    if (factorTemporada > 1.2) factores.push('Temporada alta');
    if (factorTipo > 1.2) factores.push('Tipo de cliente premium');
    if (factorTemporada < 0.8) factores.push('Temporada baja');
    if (factorDia < 0.8) factores.push('Día de baja demanda');

    // Generar recomendaciones basadas en datos reales
    const recomendaciones = [];
    if (totalPedidos > promedio_pedidos_mensual / 30 * 1.5) {
      recomendaciones.push('Aumentar stock en un 20%');
      recomendaciones.push('Preparar equipo adicional');
    }
    if (factorTemporada > 1.3) {
      recomendaciones.push('Contactar clientes frecuentes');
    }
    if (totalPedidos < promedio_pedidos_mensual / 30 * 0.7) {
      recomendaciones.push('Reducir personal temporalmente');
    }

    return {
      prediccionesPorZona,
      totalPedidos,
      confianza,
      factores: factores.length > 0 ? factores : ['Patrón normal de demanda'],
      recomendaciones: recomendaciones.length > 0 ? recomendaciones : ['Mantener operación normal'],
      detalles: {
        promedioBase: Math.round(promedioBase),
        factorDia: factorDia,
        factorTemporada: factorTemporada,
        factorTipo: factorTipo,
        datosHistoricos: factoresReales.total_pedidos_analizados,
        crecimientoMensual: tendencia,
        promedioMensual: promedio_pedidos_mensual
      }
    };
  };

  const generarPrediccion = async () => {
    setLoading(true);
    
    // Simular tiempo de procesamiento
    setTimeout(() => {
      const resultadoCalculado = calcularForecastCompleto();
      
      if (resultadoCalculado) {
        setResultado(resultadoCalculado);
        
        // Generar análisis automático
        const analisis = generarAnalisisAutomatico(resultadoCalculado, prediccion);
        
        // Agregar al historial
        const nuevoHistorial = [analisis, ...historialPredicciones.slice(0, 9)]; // Mantener solo los últimos 10
        setHistorialPredicciones(nuevoHistorial);
        guardarHistorialLocal(nuevoHistorial);
        
        // Actualizar cumplimiento con datos simulados para el total
        const pedidosRealesSimulados = Math.round(resultadoCalculado.totalPedidos * (0.8 + Math.random() * 0.4)); // ±20% variabilidad
        
        setCumplimiento({
          prediccionEsperada: resultadoCalculado.totalPedidos,
          pedidosReales: pedidosRealesSimulados,
          fecha: prediccion.fecha,
          tipoCliente: prediccion.tipoCliente
        });
      } else {
        setResultado({
          prediccionesPorZona: {},
          totalPedidos: 0,
          confianza: 0,
          factores: ['Datos insuficientes'],
          recomendaciones: ['Completar todos los parámetros']
        });
      }
      
      setLoading(false);
    }, 2000);
  };

  const getIconoAnalisis = (tipo) => {
    switch (tipo) {
      case 'success': return <CheckCircle sx={{ color: '#10b981' }} />;
      case 'warning': return <Warning sx={{ color: '#f59e0b' }} />;
      case 'info': return <Info sx={{ color: '#3b82f6' }} />;
      default: return <Info sx={{ color: '#6b7280' }} />;
    }
  };

  return (
    <Box sx={{ 
      p: 3,
      minHeight: '100vh',
      overflow: 'auto',
      height: '100vh'
    }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ 
          color: '#1e293b', 
          fontWeight: 700, 
          mb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <TrendingUp sx={{ fontSize: 32, color: '#3b82f6' }} />
          Predictor de Pedidos
        </Typography>
        <Typography variant="body1" sx={{ 
          color: 'text.primary',
          fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility'
        }}>
          Analiza patrones históricos y genera predicciones inteligentes para optimizar la logística
        </Typography>
        {factoresReales && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Análisis basado en {factoresReales.total_pedidos_analizados} pedidos reales de Aguas Ancud
            ({factoresReales.periodo_analisis.fecha_inicio} a {factoresReales.periodo_analisis.fecha_fin})
          </Alert>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Formulario de predicción */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: 'fit-content' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, color: '#1e293b', fontWeight: 600 }}>
                Parámetros de Predicción
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Fecha objetivo"
                    type="date"
                    name="fecha"
                    value={prediccion.fecha}
                    onChange={handleInputChange}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Tipo de cliente</InputLabel>
                    <Select
                      name="tipoCliente"
                      value={prediccion.tipoCliente}
                      onChange={handleInputChange}
                      label="Tipo de cliente"
                    >
                      <MenuItem value="recurrente">Cliente recurrente</MenuItem>
                      <MenuItem value="nuevo">Cliente nuevo</MenuItem>
                      <MenuItem value="empresa">Empresa</MenuItem>
                      <MenuItem value="residencial">Residencial</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Período histórico (días)"
                    type="number"
                    name="historico"
                    value={prediccion.historico}
                    onChange={handleInputChange}
                    placeholder="30"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={generarPrediccion}
                    disabled={loading || !prediccion.fecha || !prediccion.tipoCliente || !factoresReales}
                    sx={{ 
                      mt: 2,
                      bgcolor: '#3b82f6',
                      '&:hover': { bgcolor: '#2563eb' }
                    }}
                  >
                    {loading ? 'Generando predicción...' : 'Generar Predicción Completa'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Resultados de predicción */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, color: '#1e293b', fontWeight: 600 }}>
                Resultados de Predicción Completa
              </Typography>
              
              {loading && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body2" sx={{ 
                    mb: 1,
                    color: 'text.primary',
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>
                    Analizando patrones históricos para todas las zonas...
                  </Typography>
                  <LinearProgress />
                </Box>
              )}
              
              {resultado && resultado.totalPedidos > 0 ? (
                <Box>
                  <Alert severity="info" sx={{ mb: 3 }}>
                    Predicción generada con {resultado.confianza}% de confianza
                  </Alert>
                  
                  {/* Resumen Total */}
                  <Box sx={{ mb: 3, p: 2, bgcolor: '#f0f9ff', borderRadius: 2, border: '1px solid #0ea5e9' }}>
                    <Typography variant="h5" sx={{ color: '#0ea5e9', fontWeight: 700, mb: 1 }}>
                      Total Esperado: {resultado.totalPedidos} pedidos
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Distribución completa para {prediccion.fecha} - {prediccion.tipoCliente}
                    </Typography>
                  </Box>

                  {/* Tabla Comparativa */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Predicción por Zona:
                  </Typography>
                  <TableContainer component={Paper} sx={{ mb: 3 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Zona</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Pedidos</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>% Total</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>Factor Zona</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 600 }}>Prioridad</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(resultado.prediccionesPorZona).map(([zona, datos]) => {
                          const prioridad = datos.porcentaje > 25 ? 'Alta' : 
                                          datos.porcentaje > 15 ? 'Media' : 'Baja';
                          const colorPrioridad = prioridad === 'Alta' ? '#10b981' : 
                                               prioridad === 'Media' ? '#f59e0b' : '#ef4444';
                          
                          return (
                            <TableRow key={zona}>
                              <TableCell sx={{ textTransform: 'capitalize', fontWeight: 500 }}>
                                {zona}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {datos.pedidos}
                              </TableCell>
                              <TableCell align="right">
                                {datos.porcentaje}%
                              </TableCell>
                              <TableCell align="right">
                                {datos.factorZona}
                              </TableCell>
                              <TableCell align="center">
                                <Box sx={{ 
                                  color: colorPrioridad, 
                                  fontWeight: 600,
                                  fontSize: '0.875rem'
                                }}>
                                  {prioridad}
                                </Box>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Gráfico de Distribución */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Distribución por Zona:
                  </Typography>
                  <Box sx={{ mb: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                    <Grid container spacing={2}>
                      {Object.entries(resultado.prediccionesPorZona).map(([zona, datos]) => (
                        <Grid item xs={12} sm={6} md={4} key={zona}>
                          <Box sx={{ 
                            p: 2, 
                            bgcolor: '#fff', 
                            borderRadius: 1, 
                            border: '1px solid #e2e8f0',
                            textAlign: 'center'
                          }}>
                            <Typography variant="h6" sx={{ color: '#3b82f6', fontWeight: 700 }}>
                              {datos.pedidos}
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              textTransform: 'capitalize', 
                              color: 'text.primary',
                              fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                              textRendering: 'optimizeLegibility'
                            }}>
                              {zona}
                            </Typography>
                            <Box sx={{ 
                              width: '100%', 
                              height: 8, 
                              bgcolor: '#e2e8f0', 
                              borderRadius: 4, 
                              mt: 1,
                              overflow: 'hidden'
                            }}>
                              <Box sx={{ 
                                width: `${datos.porcentaje}%`, 
                                height: '100%', 
                                bgcolor: '#3b82f6',
                                borderRadius: 4
                              }} />
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              {datos.porcentaje}% del total
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                  
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Factores considerados:
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    {resultado.factores.map((factor, index) => (
                      <Typography key={index} variant="body2" sx={{ 
                        mb: 1, 
                        color: 'text.primary',
                        fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                        WebkitFontSmoothing: 'antialiased',
                        MozOsxFontSmoothing: 'grayscale',
                        textRendering: 'optimizeLegibility'
                      }}>
                        • {factor}
                      </Typography>
                    ))}
                  </Box>
                  
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Recomendaciones:
                  </Typography>
                  <Box>
                    {resultado.recomendaciones.map((rec, index) => (
                      <Typography key={index} variant="body2" sx={{ mb: 1, color: '#059669' }}>
                        • {rec}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  py: 4,
                  color: '#64748b'
                }}>
                  <BarChart sx={{ fontSize: 48 }} />
                  <Typography variant="body1" sx={{ 
                    mt: 2, 
                    textAlign: 'center',
                    color: 'text.primary',
                    fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility'
                  }}>
                    Completa los parámetros y genera una predicción para ver los resultados completos por zona
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Card de Cumplimiento de Predicción */}
      {cumplimiento.prediccionEsperada > 0 && (
        <Grid container spacing={3} sx={{ mt: 3 }}>
          <Grid item xs={12} md={4}>
            <PrediccionCumplimientoCard
              prediccionEsperada={cumplimiento.prediccionEsperada}
              pedidosReales={cumplimiento.pedidosReales}
              fecha={cumplimiento.fecha}
              tipoCliente={cumplimiento.tipoCliente}
            />
          </Grid>
        </Grid>
      )}

      {/* Historial de Predicciones */}
      {historialPredicciones.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 3, color: '#1e293b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            <History sx={{ color: '#3b82f6' }} />
            Historial de Análisis de Predicciones
          </Typography>
          
          {historialPredicciones.map((analisis, index) => (
            <Card key={index} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                      {analisis.titulo}
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      color: 'text.primary',
                      fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale',
                      textRendering: 'optimizeLegibility'
                    }}>
                      {new Date(analisis.timestamp).toLocaleString('es-ES')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip 
                      label={`${analisis.nivelConfianza}% confianza`}
                      color={analisis.nivelConfianza >= 90 ? 'success' : analisis.nivelConfianza >= 75 ? 'warning' : 'error'}
                      size="small"
                    />
                    <IconButton onClick={() => toggleHistorial(index)} size="small">
                      {expandedHistorial[index] ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                    <IconButton 
                      onClick={() => eliminarPrediccion(index)} 
                      size="small"
                      sx={{ 
                        color: '#ef4444',
                        '&:hover': { 
                          bgcolor: '#fef2f2',
                          color: '#dc2626'
                        }
                      }}
                      title="Eliminar predicción"
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </Box>
                
                <Typography variant="body1" sx={{ 
                  mb: 2, 
                  color: 'text.primary', 
                  fontWeight: 500,
                  fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeLegibility'
                }}>
                  {analisis.resumen}
                </Typography>

                <Collapse in={expandedHistorial[index]}>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#1e293b' }}>
                      Análisis Detallado:
                    </Typography>
                    
                    {analisis.detalles.map((detalle, detalleIndex) => (
                      <Box key={detalleIndex} sx={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: 1, 
                        mb: 1.5,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: detalle.tipo === 'success' ? '#f0fdf4' : 
                                 detalle.tipo === 'warning' ? '#fffbeb' : '#eff6ff'
                      }}>
                        {getIconoAnalisis(detalle.tipo)}
                        <Typography variant="body2" sx={{ 
                          color: 'text.primary',
                          fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
                          WebkitFontSmoothing: 'antialiased',
                          MozOsxFontSmoothing: 'grayscale',
                          textRendering: 'optimizeLegibility'
                        }}>
                          {detalle.mensaje}
                        </Typography>
                      </Box>
                    ))}
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Zonas Activas:</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                          {analisis.zonasActivas.map((zona, zonaIndex) => (
                            <Chip key={zonaIndex} label={zona} size="small" color="success" />
                          ))}
                        </Box>
                      </Box>
                      
                      {analisis.zonasInactivas.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Zonas Inactivas:</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                            {analisis.zonasInactivas.map((zona, zonaIndex) => (
                              <Chip key={zonaIndex} label={zona} size="small" color="default" />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
} 