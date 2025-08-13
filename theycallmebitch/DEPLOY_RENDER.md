# Guía de Despliegue en Render

## Descripción del Proyecto
Este proyecto consiste en un dashboard para Aguas Ancud con:
- **Backend**: API REST con FastAPI (Python)
- **Frontend**: Aplicación React con Vite

## Configuración para Render

### 1. Preparación del Repositorio

Asegúrate de que tu repositorio tenga la siguiente estructura:
```
theycallmebitch/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── render.yaml
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
```

### 2. Configuración de Variables de Entorno

#### Backend (FastAPI)
- `PYTHON_VERSION`: 3.9.0
- `CORS_ORIGIN`: https://dashboard-aguas-ancud-frontend.onrender.com

#### Frontend (React)
- `VITE_API_URL`: https://dashboard-aguas-ancud-backend.onrender.com

### 3. Pasos para Desplegar

#### Paso 1: Crear cuenta en Render
1. Ve a [render.com](https://render.com)
2. Crea una cuenta o inicia sesión
3. Conecta tu repositorio de GitHub

#### Paso 2: Desplegar el Backend
1. En Render Dashboard, haz clic en "New +"
2. Selecciona "Web Service"
3. Conecta tu repositorio
4. Configura el servicio:
   - **Name**: dashboard-aguas-ancud-backend
   - **Environment**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Root Directory**: `theycallmebitch/backend`

#### Paso 3: Desplegar el Frontend
1. En Render Dashboard, haz clic en "New +"
2. Selecciona "Static Site"
3. Conecta tu repositorio
4. Configura el servicio:
   - **Name**: dashboard-aguas-ancud-frontend
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Root Directory**: `theycallmebitch/frontend`

### 4. Configuración Automática con render.yaml

Alternativamente, puedes usar el archivo `render.yaml` para desplegar ambos servicios automáticamente:

1. Ve a tu repositorio en Render
2. Selecciona "Blueprint"
3. Render detectará automáticamente el archivo `render.yaml`
4. Sigue las instrucciones para crear ambos servicios

### 5. URLs de Producción

Una vez desplegado, tendrás acceso a:
- **Backend API**: https://dashboard-aguas-ancud-backend.onrender.com
- **Frontend Dashboard**: https://dashboard-aguas-ancud-frontend.onrender.com

### 6. Verificación del Despliegue

#### Verificar Backend
```bash
curl https://dashboard-aguas-ancud-backend.onrender.com/docs
```

#### Verificar Frontend
- Abre https://dashboard-aguas-ancud-frontend.onrender.com
- Verifica que las llamadas a la API funcionen correctamente

### 7. Troubleshooting

#### Problemas Comunes

1. **Error de CORS**
   - Verifica que `CORS_ORIGIN` esté configurado correctamente
   - Asegúrate de que la URL del frontend esté en la lista de orígenes permitidos

2. **Error de Build**
   - Verifica que todas las dependencias estén en `requirements.txt`
   - Revisa los logs de build en Render

3. **Error de Conexión API**
   - Verifica que `VITE_API_URL` esté configurado correctamente
   - Asegúrate de que el backend esté funcionando

4. **Error de Puerto**
   - Render asigna automáticamente el puerto via `$PORT`
   - No hardcodees puertos en el código

### 8. Monitoreo

- Usa los logs de Render para monitorear el rendimiento
- Configura alertas para downtime
- Monitorea el uso de recursos en el plan gratuito

### 9. Actualizaciones

Para actualizar el proyecto:
1. Haz push a tu repositorio
2. Render detectará automáticamente los cambios
3. Desplegará automáticamente las nuevas versiones

### 10. Consideraciones del Plan Gratuito

- **Backend**: Se duerme después de 15 minutos de inactividad
- **Frontend**: Siempre disponible
- **Límites**: 750 horas/mes para servicios web
- **Recomendación**: Considera actualizar a un plan pagado para producción

## Soporte

Si tienes problemas con el despliegue:
1. Revisa los logs en Render Dashboard
2. Verifica la configuración de variables de entorno
3. Asegúrate de que el código funcione localmente antes de desplegar
