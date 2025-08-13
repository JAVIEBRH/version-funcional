# Script de despliegue automático para Render (PowerShell)
# Autor: Sistema de Aguas Ancud
# Fecha: $(Get-Date)

Write-Host "🚀 Iniciando despliegue a Render..." -ForegroundColor Green

# Función para imprimir mensajes
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "theycallmebitch/backend/main.py")) {
    Write-Error "No se encontró el archivo main.py. Asegúrate de estar en el directorio raíz del proyecto."
    exit 1
}

Write-Status "Verificando estructura del proyecto..."

# Verificar archivos necesarios
$requiredFiles = @(
    "theycallmebitch/backend/main.py",
    "theycallmebitch/backend/requirements.txt",
    "theycallmebitch/backend/render.yaml",
    "theycallmebitch/frontend/package.json",
    "theycallmebitch/frontend/vite.config.js"
)

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Error "Archivo requerido no encontrado: $file"
        exit 1
    }
}

Write-Status "✅ Estructura del proyecto verificada"

# Verificar si git está configurado
try {
    $null = git rev-parse --git-dir 2>$null
} catch {
    Write-Error "No se detectó un repositorio Git. Inicializa Git primero."
    exit 1
}

Write-Status "Verificando estado de Git..."

# Verificar si hay cambios sin commitear
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Warning "Hay cambios sin commitear. ¿Deseas continuar? (y/n)"
    $response = Read-Host
    if ($response -notmatch "^[Yy]$") {
        Write-Status "Despliegue cancelado"
        exit 0
    }
}

# Verificar si el repositorio remoto está configurado
try {
    $remoteUrl = git remote get-url origin 2>$null
} catch {
    Write-Error "No se encontró un repositorio remoto. Configura origin primero."
    exit 1
}

Write-Status "✅ Repositorio Git verificado"

# Mostrar información del repositorio
Write-Status "Información del repositorio:"
Write-Host "  - URL remota: $remoteUrl"
Write-Host "  - Rama actual: $(git branch --show-current)"
Write-Host "  - Último commit: $(git log -1 --oneline)"

# Verificar si el repositorio está en GitHub
if ($remoteUrl -notmatch "github\.com") {
    Write-Warning "El repositorio no parece estar en GitHub. Render requiere GitHub para el despliegue automático."
}

Write-Status "📋 Pasos para completar el despliegue:"
Write-Host ""
Write-Host "1. 🌐 Ve a https://render.com y crea una cuenta"
Write-Host "2. 🔗 Conecta tu repositorio de GitHub"
Write-Host "3. 📁 Usa el archivo render.yaml para despliegue automático:"
Write-Host "   - Selecciona 'Blueprint' en Render"
Write-Host "   - Render detectará automáticamente el archivo render.yaml"
Write-Host ""
Write-Host "4. ⚙️  Configura las variables de entorno:"
Write-Host "   Backend:"
Write-Host "   - PYTHON_VERSION: 3.9.0"
Write-Host "   - CORS_ORIGIN: https://dashboard-aguas-ancud-frontend.onrender.com"
Write-Host ""
Write-Host "   Frontend:"
Write-Host "   - VITE_API_URL: https://dashboard-aguas-ancud-backend.onrender.com"
Write-Host ""
Write-Host "5. 🚀 Render desplegará automáticamente ambos servicios"
Write-Host ""
Write-Host "📖 Para más detalles, consulta DEPLOY_RENDER.md"

# Verificar si el usuario quiere hacer push ahora
Write-Status "¿Deseas hacer push de los cambios actuales a GitHub? (y/n)"
$response = Read-Host
if ($response -match "^[Yy]$") {
    Write-Status "Haciendo push a GitHub..."
    git add .
    git commit -m "Preparación para despliegue en Render - $(Get-Date)"
    git push origin main
    Write-Status "✅ Push completado"
} else {
    Write-Warning "Recuerda hacer push de tus cambios antes de desplegar en Render"
}

Write-Status "🎉 Preparación completada. Sigue los pasos anteriores para completar el despliegue en Render."
Write-Status "📞 Si necesitas ayuda, consulta la documentación en DEPLOY_RENDER.md"
