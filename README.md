# Dashboard Aguas Ancud

Dashboard web completo para la gestión y visualización de datos de Aguas Ancud, desarrollado con React (Frontend) y FastAPI (Backend).

## 🚀 Características

### Frontend (React)
- **Dashboard Interactivo**: KPI cards con diseño elegante y drag & drop
- **Gráficos Dinámicos**: Ventas históricas, pedidos por horario, mapas de calor
- **Navegación Intuitiva**: Sidebar con múltiples páginas y navegación fluida
- **Actualización Automática**: Datos se actualizan cada 10 minutos
- **Modo Oscuro/Claro**: Interfaz adaptable con temas Material-UI
- **Responsive Design**: Optimizado para desktop y dispositivos móviles

### Backend (FastAPI)
- **API RESTful**: Endpoints para todos los datos del dashboard
- **CORS Configurado**: Para comunicación segura con el frontend
- **Datos Simulados**: Estructura de datos realista para demostración
- **Endpoints Principales**:
  - `/clientes` - Lista de clientes con métricas
  - `/pedidos` - Historial de pedidos
  - `/ventas-totales-historicas` - Ventas acumuladas
  - `/ventas-mensuales` - Datos de ventas por mes
  - `/predicciones` - Predicciones de pedidos

## 📁 Estructura del Proyecto

```
proyectoreatc/
├── theycallmebitch/
│   ├── frontend/                 # Aplicación React
│   │   ├── src/
│   │   │   ├── components/      # Componentes reutilizables
│   │   │   ├── pages/          # Páginas principales
│   │   │   ├── services/       # Servicios API
│   │   │   └── context/        # Contexto global
│   │   └── package.json
│   ├── backend/                 # API FastAPI
│   │   ├── main.py             # Servidor principal
│   │   ├── requirements.txt    # Dependencias Python
│   │   └── test_*.py          # Archivos de prueba
│   └── README.md
├── start-frontend.bat          # Script para iniciar frontend
├── start-backend.bat           # Script para iniciar backend
└── start-dashboard.bat         # Script para iniciar ambos
```

## 🛠️ Tecnologías Utilizadas

### Frontend
- **React 18** - Biblioteca de interfaz de usuario
- **Material-UI (MUI)** - Componentes de diseño
- **Recharts** - Biblioteca de gráficos
- **Vite** - Herramienta de construcción
- **React Router** - Navegación entre páginas

### Backend
- **FastAPI** - Framework web moderno y rápido
- **Python 3.11+** - Lenguaje de programación
- **Uvicorn** - Servidor ASGI
- **Pydantic** - Validación de datos

## 🚀 Instalación y Configuración

### Prerrequisitos
- Node.js 16+ y npm
- Python 3.11+
- Git

### Pasos de Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <url-del-repositorio>
   cd proyectoreatc
   ```

2. **Configurar Frontend**
   ```bash
   cd theycallmebitch/frontend
   npm install
   ```

3. **Configurar Backend**
   ```bash
   cd ../backend
   pip install -r requirements.txt
   ```

## 🏃‍♂️ Ejecución

### Opción 1: Scripts Automáticos (Windows)
```bash
# Iniciar solo frontend
start-frontend.bat

# Iniciar solo backend
start-backend.bat

# Iniciar ambos servicios
start-dashboard.bat
```

### Opción 2: Comandos Manuales

**Terminal 1 - Frontend:**
```bash
cd theycallmebitch/frontend
npm run dev
```

**Terminal 2 - Backend:**
```bash
cd theycallmebitch/backend
python main.py
```

## 🌐 Acceso a la Aplicación

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Documentación API**: http://localhost:8000/docs

## 📊 Páginas del Dashboard

### 🏠 Home
- KPI cards principales
- Gráficos de ventas históricas
- Pedidos por horario (gráfico de dona)
- Actualización automática cada 10 minutos

### 👥 Clientes
- Lista de clientes con métricas
- Porcentaje de crecimiento
- Filtros y búsqueda
- Tabla con datos detallados

### 📦 Pedidos
- Historial completo de pedidos
- Filtros por fecha y estado
- Información detallada de cada pedido

### 🔮 Predictor de Pedidos
- Predicciones basadas en datos históricos
- Gráficos de tendencias
- Métricas de precisión

### 🗺️ Mapa de Calor
- Visualización de actividad por horarios
- Patrones de pedidos
- Análisis temporal

### 🏪 Local
- Datos específicos del local físico
- KPI de ventas presenciales
- Métricas de rendimiento

## 🔧 Configuración para Render

### Variables de Entorno
```bash
# Frontend
VITE_API_URL=https://tu-backend.onrender.com

# Backend
CORS_ORIGINS=https://tu-frontend.onrender.com
```

### Build Commands
```bash
# Frontend
npm run build

# Backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port $PORT
```

## 📈 Características Avanzadas

### Actualización Automática
- Sistema de contexto global para sincronización
- Eventos personalizados para actualización manual
- Animación de carga durante actualizaciones

### Diseño Responsivo
- Adaptable a diferentes tamaños de pantalla
- Navegación optimizada para móviles
- Cards con diseño flexible

### Performance
- Lazy loading de componentes
- Optimización de imágenes
- Caching de datos

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 📞 Contacto

- **Desarrollador**: [Tu Nombre]
- **Email**: [tu-email@ejemplo.com]
- **Proyecto**: [https://github.com/tu-usuario/dashboard-aguas-ancud]

---

**Dashboard Aguas Ancud** - Sistema de gestión y visualización de datos empresariales 