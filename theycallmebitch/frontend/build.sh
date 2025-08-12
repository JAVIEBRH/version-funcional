#!/bin/bash
set -e

echo "=== Iniciando build en Render ==="
echo "Directorio actual: $(pwd)"
echo "Contenido del directorio:"
ls -la

echo "=== Instalando dependencias ==="
npm install

echo "=== Ejecutando build ==="
npm run build

echo "=== Build completado ==="
ls -la dist/
