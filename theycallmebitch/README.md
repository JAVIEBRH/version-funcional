# Dashboard Aguas Ancud

Dashboard completo para la gestión de Aguas Ancud con backend en FastAPI y frontend en React.

## 🚀 Inicio Rápido

### Opción 1: Inicio Automático (Recomendado)
Simplemente haz doble clic en el archivo:
- **`start-dashboard.bat`** - Inicia tanto el backend como el frontend automáticamente

### Opción 2: Inicio Manual
Si prefieres iniciar los servicios por separado:

1. **Backend**: Doble clic en `start-backend.bat`
2. **Frontend**: Doble clic en `start-frontend.bat`

## 📋 Requisitos Previos

Antes de usar los scripts, asegúrate de tener instalado:

- **Python 3.8+** con pip
- **Node.js 16+** con npm
- **Git** (opcional, para clonar el repositorio)

## 🌐 URLs de Acceso

Una vez iniciados los servicios:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Documentación API**: http://localhost:8000/docs

## 📁 Estructura del Proyecto

```
theycallmebitch/
├── backend/                 # API FastAPI
│   ├── main.py             # Servidor principal
│   ├── requirements.txt    # Dependencias Python
│   └── README.md          # Documentación backend
├── frontend/               # Aplicación React
│   ├── src/               # Código fuente
│   ├── package.json       # Dependencias Node.js
│   └── README.md          # Documentación frontend
├── start-backend.bat      # Script inicio backend
├── start-frontend.bat     # Script inicio frontend
├── start-dashboard.bat    # Script inicio completo
└── README.md              # Este archivo
```

## 🔧 Scripts Disponibles

### `start-dashboard.bat`
- Inicia automáticamente backend y frontend
- Abre ventanas separadas para cada servicio
- Espera a que el backend esté listo antes de iniciar el frontend

### `start-backend.bat`
- Instala dependencias Python automáticamente
- Inicia el servidor FastAPI en puerto 8000
- Incluye modo de desarrollo con recarga automática

### `start-frontend.bat`
- Instala dependencias Node.js automáticamente
- Inicia el servidor de desarrollo React en puerto 3000
- Abre automáticamente el navegador

## 🛠️ Desarrollo

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

## 📊 Características del Dashboard

- ✅ **Dashboard Principal** con KPIs y métricas
- ✅ **Gestión de Pedidos** con tabla avanzada
- ✅ **Gestión de Clientes** con búsqueda y filtros
- ✅ **Gráficos Interactivos** con Recharts
- ✅ **Diseño Responsive** para móviles y desktop
- ✅ **API REST** completa con FastAPI
- ✅ **Filtros por Empresa** (Aguas Ancud)

## 🐛 Solución de Problemas

### Error: "pip no se reconoce"
- Instala Python desde https://python.org
- Asegúrate de marcar "Add Python to PATH" durante la instalación

### Error: "npm no se reconoce"
- Instala Node.js desde https://nodejs.org
- Reinicia el sistema después de la instalación

### Puerto ya en uso
- Cierra otras aplicaciones que usen los puertos 3000 o 8000
- O modifica los puertos en los archivos de configuración

### Dependencias no encontradas
- Los scripts instalan automáticamente las dependencias
- Si hay errores, ejecuta manualmente:
  - Backend: `pip install -r backend/requirements.txt`
  - Frontend: `npm install` (desde la carpeta frontend)

## 📞 Soporte

Para reportar problemas o solicitar nuevas características, contacta al equipo de desarrollo. 