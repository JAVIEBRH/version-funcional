import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import { Box, Typography, FormControl, Select, MenuItem, useTheme, CircularProgress } from '@mui/material';
import PlaceIcon from '@mui/icons-material/Place';
import PaidIcon from '@mui/icons-material/Paid';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import 'leaflet/dist/leaflet.css';
import { getHeatmap } from '../services/api';
import './MapaCalor.css';

const CYAN = '#06b6d4';

// Única fuente de verdad para los niveles de concentración: color, radio base
// y etiqueta. Antes esta escala vivía triplicada (color, radio y leyenda cada
// uno con su propia copia de los mismos umbrales de $).
const NIVELES = [
  { hasta: 3000, color: '#10b981', radio: 1, etiqueta: 'Baja' },
  { hasta: 6000, color: '#a3e635', radio: 1.5, etiqueta: 'Baja-media' },
  { hasta: 10000, color: '#facc15', radio: 2, etiqueta: 'Media' },
  { hasta: 15000, color: '#fb923c', radio: 2.5, etiqueta: 'Media-alta' },
  { hasta: Infinity, color: '#ef4444', radio: 3, etiqueta: 'Alta' },
];

function nivelDe(monto) {
  const amount = parseInt(monto) || 0;
  return NIVELES.find(n => amount <= n.hasta) || NIVELES[NIVELES.length - 1];
}

const formatoCLP = (val) => `$${(parseInt(val) || 0).toLocaleString('es-CL')}`;

// Círculos del mapa: su tamaño se ajusta al nivel de zoom para que a cualquier
// escala se sigan viendo como puntos distinguibles, no manchas o puntos invisibles.
function ZoomAwareCircles({ mapData }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const handleZoom = () => setZoom(map.getZoom());
    map.on('zoomend', handleZoom);
    return () => map.off('zoomend', handleZoom);
  }, [map]);

  const zoomFactor = Math.max(0.3, Math.min(2, (18 - zoom) / 6));

  return mapData.map((point, index) => {
    const nivel = nivelDe(point.total_spent);

    return (
      <Circle
        key={index}
        center={[point.lat, point.lng]}
        radius={nivel.radio * zoomFactor * 50}
        pathOptions={{
          color: nivel.color,
          fillColor: nivel.color,
          fillOpacity: 0.7,
          weight: 1,
        }}
      >
        <Popup className="heatmap-popup" closeButton={false} minWidth={220}>
          <Box sx={{ minWidth: 200 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: nivel.color, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(226,232,240,0.6)' }}>
                Concentración {nivel.etiqueta}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.1, mb: 0.5 }}>
              {formatoCLP(point.total_spent)}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.75)', mb: 1.5, lineHeight: 1.4 }}>
              {point.address}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, pt: 1, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <Row label="Cliente" value={point.user || 'Sin datos'} />
              <Row label="Teléfono" value={point.phone || 'Sin datos'} />
              <Row label="Ticket promedio" value={formatoCLP(point.ticket_promedio)} />
              <Row label="Último pedido" value={point.fecha_ultimo_pedido || 'N/A'} />
            </Box>
          </Box>
        </Popup>
      </Circle>
    );
  });
}

function Row({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(226,232,240,0.5)' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(226,232,240,0.85)', textAlign: 'right', fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}

// Tarjeta compacta de resumen (mismo lenguaje visual que las mini-KPI del Home).
function StatCard({ icon: Icon, label, value }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box sx={{
      flex: '1 1 160px',
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      padding: '14px 16px',
      borderRadius: '14px',
      background: isDark ? 'rgba(255,255,255,0.036)' : 'rgba(255,255,255,0.9)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.085)' : 'rgba(0,0,0,0.07)'}`,
      backdropFilter: 'blur(18px)',
    }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${CYAN}1a`, color: CYAN,
      }}>
        <Icon sx={{ fontSize: 18 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: theme.palette.text.primary, lineHeight: 1.1, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary, fontWeight: 500 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

export default function MapaCalor() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [mapData, setMapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState(6); // meses

  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      // "filterPeriod" son los últimos N meses desde hoy; el backend calcula
      // el rango real (antes se pedía un único mes/año exacto).
      const data = await getHeatmap(filterPeriod);
      const mapPoints = data.map((point) => ({
        lat: point.lat,
        lng: point.lon,
        address: point.address,
        user: point.user,
        phone: point.phone,
        total_spent: point.total_spent,
        ticket_promedio: point.ticket_promedio,
        fecha_ultimo_pedido: point.fecha_ultimo_pedido,
      }));
      setMapData(mapPoints);
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmapData();
    const interval = setInterval(fetchHeatmapData, 10 * 60 * 1000);
    const handleGlobalRefresh = () => fetchHeatmapData();
    window.addEventListener('globalRefresh', handleGlobalRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('globalRefresh', handleGlobalRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterPeriod]);

  const totalFacturado = mapData.reduce((sum, p) => sum + (parseInt(p.total_spent) || 0), 0);

  return (
    <Box sx={{
      p: { xs: 2, md: 4 },
      bgcolor: 'background.default',
      minHeight: '100vh',
    }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>

        {/* Header: título + selector de período, apilados en mobile */}
        <Box sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'flex-end' },
          gap: 2,
          mb: 3,
        }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{
              fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.85rem' },
              color: theme.palette.text.primary, letterSpacing: '-0.02em',
              fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            }}>
              Mapa de Calor
            </Typography>
            <Typography sx={{ color: theme.palette.text.secondary, fontSize: '0.9rem', mt: 0.3 }}>
              Dónde se concentran los pedidos de Aguas Ancud
            </Typography>
          </Box>

          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 } }}>
            <Select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(Number(e.target.value))}
              sx={{
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'background.paper',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
              }}
            >
              <MenuItem value={3}>Últimos 3 meses</MenuItem>
              <MenuItem value={6}>Últimos 6 meses</MenuItem>
              <MenuItem value={12}>Últimos 12 meses</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Resumen compacto: lo que antes era un bloque de texto al final del
            todo, ahora está arriba como 3 datos rápidos de un vistazo. */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
          <StatCard icon={PlaceIcon} label="Direcciones en el mapa" value={mapData.length.toLocaleString('es-CL')} />
          <StatCard icon={PaidIcon} label="Total facturado en el período" value={formatoCLP(totalFacturado)} />
          <StatCard icon={ReceiptLongIcon} label="Período" value={`${filterPeriod} meses`} />
        </Box>

        {/* Mapa */}
        <Box sx={{
          borderRadius: '18px',
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: theme.shadows[1],
          position: 'relative',
        }}>
          {loading && (
            <Box sx={{
              position: 'absolute', inset: 0, zIndex: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 1.5,
              bgcolor: isDark ? 'rgba(8,15,25,0.6)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(3px)',
            }}>
              <CircularProgress size={22} thickness={4} sx={{ color: CYAN }} />
              <Typography sx={{ fontSize: '0.85rem', color: theme.palette.text.secondary, fontWeight: 500 }}>
                Cargando mapa…
              </Typography>
            </Box>
          )}

          {!loading && mapData.length === 0 && (
            <Box sx={{
              position: 'absolute', inset: 0, zIndex: 500,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 1, textAlign: 'center', px: 3,
              bgcolor: isDark ? 'rgba(8,15,25,0.72)' : 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(4px)',
            }}>
              <PlaceIcon sx={{ fontSize: 30, color: theme.palette.text.secondary, opacity: 0.5 }} />
              <Typography sx={{ fontWeight: 700, color: theme.palette.text.primary }}>
                No hay pedidos en este período
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', color: theme.palette.text.secondary, maxWidth: 320 }}>
                Prueba con un rango más amplio, como "Últimos 12 meses".
              </Typography>
            </Box>
          )}

          <MapContainer
            center={[-33.6167, -70.5833]} // Puente Alto, Santiago
            zoom={12}
            className={`heatmap-map ${isDark ? 'heatmap-map--dark' : ''}`}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <ZoomAwareCircles mapData={mapData} />
          </MapContainer>
        </Box>

        {/* Leyenda: franja horizontal compacta en vez del bloque largo de antes */}
        <Box sx={{
          mt: 2,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: { xs: 1.5, sm: 2.5 },
          rowGap: 1,
        }}>
          {NIVELES.map((n) => (
            <Box key={n.etiqueta} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: n.color, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary, whiteSpace: 'nowrap' }}>
                {n.etiqueta}
              </Typography>
            </Box>
          ))}
          <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary, opacity: 0.7, ml: { sm: 'auto' } }}>
            Toca un punto para ver el detalle
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
