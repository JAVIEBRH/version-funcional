#!/bin/bash
set -e

echo "=== Iniciando build ==="
echo "Directorio actual: $(pwd)"
echo "Contenido del directorio:"
ls -la

echo "=== Navegando al directorio frontend ==="
cd theycallmebitch/frontend
echo "Directorio actual después de cd: $(pwd)"
echo "Contenido del directorio frontend:"
ls -la

echo "=== Instalando dependencias ==="
npm install

echo "=== Ejecutando build ==="
npm run build

echo "=== Build completado ==="
ls -la dist/ 