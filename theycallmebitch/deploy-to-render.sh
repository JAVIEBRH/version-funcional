#!/bin/bash

# Script de despliegue automático para Render
# Autor: Sistema de Aguas Ancud
# Fecha: $(date)

echo "🚀 Iniciando despliegue a Render..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "theycallmebitch/backend/main.py" ]; then
    print_error "No se encontró el archivo main.py. Asegúrate de estar en el directorio raíz del proyecto."
    exit 1
fi

print_status "Verificando estructura del proyecto..."

# Verificar archivos necesarios
required_files=(
    "theycallmebitch/backend/main.py"
    "theycallmebitch/backend/requirements.txt"
    "theycallmebitch/backend/render.yaml"
    "theycallmebitch/frontend/package.json"
    "theycallmebitch/frontend/vite.config.js"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Archivo requerido no encontrado: $file"
        exit 1
    fi
done

print_status "✅ Estructura del proyecto verificada"

# Verificar si git está configurado
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "No se detectó un repositorio Git. Inicializa Git primero."
    exit 1
fi

print_status "Verificando estado de Git..."

# Verificar si hay cambios sin commitear
if ! git diff-index --quiet HEAD --; then
    print_warning "Hay cambios sin commitear. ¿Deseas continuar? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_status "Despliegue cancelado"
        exit 0
    fi
fi

# Verificar si el repositorio remoto está configurado
if ! git remote get-url origin > /dev/null 2>&1; then
    print_error "No se encontró un repositorio remoto. Configura origin primero."
    exit 1
fi

print_status "✅ Repositorio Git verificado"

# Mostrar información del repositorio
print_status "Información del repositorio:"
echo "  - URL remota: $(git remote get-url origin)"
echo "  - Rama actual: $(git branch --show-current)"
echo "  - Último commit: $(git log -1 --oneline)"

# Verificar si el repositorio está en GitHub
if [[ $(git remote get-url origin) != *"github.com"* ]]; then
    print_warning "El repositorio no parece estar en GitHub. Render requiere GitHub para el despliegue automático."
fi

print_status "📋 Pasos para completar el despliegue:"
echo ""
echo "1. 🌐 Ve a https://render.com y crea una cuenta"
echo "2. 🔗 Conecta tu repositorio de GitHub"
echo "3. 📁 Usa el archivo render.yaml para despliegue automático:"
echo "   - Selecciona 'Blueprint' en Render"
echo "   - Render detectará automáticamente el archivo render.yaml"
echo ""
echo "4. ⚙️  Configura las variables de entorno:"
echo "   Backend:"
echo "   - PYTHON_VERSION: 3.9.0"
echo "   - CORS_ORIGIN: https://dashboard-aguas-ancud-frontend.onrender.com"
echo ""
echo "   Frontend:"
echo "   - VITE_API_URL: https://dashboard-aguas-ancud-backend.onrender.com"
echo ""
echo "5. 🚀 Render desplegará automáticamente ambos servicios"
echo ""
echo "📖 Para más detalles, consulta DEPLOY_RENDER.md"

# Verificar si el usuario quiere hacer push ahora
print_status "¿Deseas hacer push de los cambios actuales a GitHub? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    print_status "Haciendo push a GitHub..."
    git add .
    git commit -m "Preparación para despliegue en Render - $(date)"
    git push origin main
    print_status "✅ Push completado"
else
    print_warning "Recuerda hacer push de tus cambios antes de desplegar en Render"
fi

print_status "🎉 Preparación completada. Sigue los pasos anteriores para completar el despliegue en Render."
print_status "📞 Si necesitas ayuda, consulta la documentación en DEPLOY_RENDER.md"
