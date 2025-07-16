import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './MapaCalor.css';

// Componente para manejar el zoom dinámicamente
function ZoomAwareCircles({ mapData }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const handleZoom = () => {
      setZoom(map.getZoom());
    };

    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map]);

  // Función para obtener color basado en concentración
  const getColorByConcentration = (totalSpent) => {
    const amount = parseInt(totalSpent) || 0;
    
    if (amount > 15000) return '#ff0000';      // Rojo - alta concentración
    if (amount > 10000) return '#ff6600';      // Naranja - media-alta
    if (amount > 6000) return '#ffcc00';       // Amarillo - media
    if (amount > 3000) return '#99cc00';       // Verde-amarillo - baja-media
    return '#00cc00';                          // Verde - baja concentración
  };

  // Función para obtener radio basado en concentración Y ZOOM - LÓGICA CORREGIDA
  const getRadiusByConcentrationAndZoom = (totalSpent) => {
    const amount = parseInt(totalSpent) || 0;
    
    // Radio base según concentración
    let baseRadius;
    if (amount > 15000) baseRadius = 3;   // Alta concentración
    else if (amount > 10000) baseRadius = 2.5; // Media-alta
    else if (amount > 6000) baseRadius = 2;    // Media
    else if (amount > 3000) baseRadius = 1.5;  // Baja-media
    else baseRadius = 1;                       // Baja concentración
    
    // Ajustar según el zoom - LÓGICA INVERTIDA
    // Zoom alto (acercado) = círculos más pequeños
    // Zoom bajo (alejado) = círculos más grandes
    const zoomFactor = Math.max(0.3, Math.min(2, (18 - zoom) / 6)); // Factor entre 0.3 y 2
    return baseRadius * zoomFactor;
  };

  return mapData.map((point, index) => {
    const totalSpent = parseInt(point.total_spent) || 0;
    const radius = getRadiusByConcentrationAndZoom(totalSpent);
    
    return (
      <Circle
        key={index}
        center={[point.lat, point.lng]}
        radius={radius * 50} // Convertir a metros
        pathOptions={{
          color: getColorByConcentration(totalSpent),
          fillColor: getColorByConcentration(totalSpent),
          fillOpacity: 0.7,
          weight: 0.5
        }}
      >
        <Popup>
          <div>
            <h3>Ubicación de Pedido</h3>
            <p><strong>Dirección:</strong> {point.address}</p>
            <p><strong>Cliente:</strong> {point.user}</p>
            <p><strong>Teléfono:</strong> {point.phone}</p>
            <p><strong>Total gastado:</strong> ${parseInt(point.total_spent).toLocaleString('es-CL')}</p>
            <p><strong>Concentración:</strong> {
              parseInt(point.total_spent) > 15000 ? 'Alta' :
              parseInt(point.total_spent) > 10000 ? 'Media-Alta' :
              parseInt(point.total_spent) > 6000 ? 'Media' :
              parseInt(point.total_spent) > 3000 ? 'Baja-Media' : 'Baja'
            }</p>
            <p><strong>Coordenadas:</strong> {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>
            <p><strong>Zoom actual:</strong> {zoom.toFixed(1)}x</p>
          </div>
        </Popup>
      </Circle>
    );
  });
}

export default function MapaCalor() {
  const [mapData, setMapData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState(6); // meses por defecto

  // Función para obtener datos del heatmap desde el backend
  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      
      // Para períodos largos, no usar filtro de mes/año específico
      let url = 'http://localhost:8000/heatmap';
      
      // Solo aplicar filtro de mes/año para períodos cortos (3-6 meses)
      if (filterPeriod <= 6) {
        const currentDate = new Date();
        const targetDate = new Date();
        targetDate.setMonth(currentDate.getMonth() - filterPeriod);
        
        const mes = targetDate.getMonth() + 1; // getMonth() devuelve 0-11
        const anio = targetDate.getFullYear();
        
        url = `http://localhost:8000/heatmap?mes=${mes}&anio=${anio}`;
      }
      
      console.log('Solicitando datos con URL:', url);
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('Datos del heatmap recibidos:', data);
        
        // Convertir datos a formato de mapa
        const mapPoints = data.map((point, index) => ({
          lat: point.lat,
          lng: point.lon,
          count: 1,
          address: point.address,
          user: point.user,
          phone: point.phone,
          total_spent: point.total_spent,
          isClient: true
        }));
        
        setMapData(mapPoints);
        setLoading(false);
      } else {
        console.error('Error al obtener datos del heatmap:', response.status);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmapData();
    
    // Actualización automática cada 10 minutos
    const interval = setInterval(() => {
      console.log('Actualización automática del mapa de calor...');
      fetchHeatmapData();
    }, 10 * 60 * 1000); // 10 minutos

    // Escuchar evento de actualización global
    const handleGlobalRefresh = () => {
      console.log('Actualización global detectada en MapaCalor...');
      fetchHeatmapData();
    };

    window.addEventListener('globalRefresh', handleGlobalRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('globalRefresh', handleGlobalRefresh);
    };
  }, [filterPeriod]);

  if (loading) {
    return (
      <div className="mapa-calor">
        <div className="page-header">
          <h1>Mapa de Calor - Concentración de Pedidos</h1>
          <p>Cargando datos del mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mapa-calor">
      <div className="page-header">
        <h1>Mapa de Calor - Concentración de Pedidos</h1>
        <p>Visualiza las zonas con mayor concentración de pedidos en el período seleccionado</p>
        
        <div className="filter-controls">
          <label>Período de análisis:</label>
          <select 
            value={filterPeriod} 
            onChange={(e) => setFilterPeriod(Number(e.target.value))}
            className="period-filter"
          >
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
        </div>
      </div>
      
      <div className="map-container">
        <MapContainer
          center={[-33.6167, -70.5833]} // Puente Alto, Santiago
          zoom={12}
          style={{ height: '600px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          <ZoomAwareCircles mapData={mapData} />
        </MapContainer>
        
        <div className="map-legend">
          <h3>Leyenda - Concentración de Pedidos</h3>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#00cc00' }}></div>
            <span>Baja concentración (0 - $3.000)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#99cc00' }}></div>
            <span>Baja-Media ($3.001 - $6.000)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#ffcc00' }}></div>
            <span>Media ($6.001 - $10.000)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#ff6600' }}></div>
            <span>Media-Alta ($10.001 - $15.000)</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ backgroundColor: '#ff0000' }}></div>
            <span>Alta concentración ($15.001+)</span>
          </div>
          <div className="legend-stats">
            <p><strong>Total de pedidos mostrados:</strong> {mapData.length}</p>
            <p><strong>Período:</strong> Últimos {filterPeriod} meses</p>
            <p><strong>Total facturado:</strong> ${mapData.reduce((sum, point) => sum + parseInt(point.total_spent || 0), 0).toLocaleString('es-CL')}</p>
            <p><em>💡 Los círculos se ajustan automáticamente al nivel de zoom</em></p>
          </div>
        </div>
      </div>
    </div>
  );
} 