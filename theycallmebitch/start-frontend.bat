@echo off
echo ========================================
echo    INICIANDO FRONTEND - AGUAS ANCUD
echo ========================================
echo.

cd /d "%~dp0frontend"

echo Instalando dependencias...
call npm install

echo.
echo Iniciando servidor frontend en http://localhost:3000
echo.
call npm run dev

echo.
echo (Si ves este mensaje, cierra la ventana manualmente para terminar)
pause 