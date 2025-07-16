@echo off
echo ========================================
echo    DASHBOARD AGUAS ANCUD - INICIANDO
echo ========================================
echo.
echo Este script iniciará tanto el backend como el frontend
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Presiona cualquier tecla para continuar...
pause >nul

echo.
echo Iniciando backend...
start "Backend - Aguas Ancud" cmd /k "cd /d "%~dp0" && start-backend.bat"

echo Esperando 5 segundos para que el backend se inicie...
timeout /t 5 /nobreak >nul

echo.
echo Iniciando frontend...
start "Frontend - Aguas Ancud" cmd /k "cd /d "%~dp0" && start-frontend.bat"

echo.
echo ========================================
echo    DASHBOARD INICIADO EXITOSAMENTE
echo ========================================
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Los navegadores se abrirán automáticamente.
echo Para detener los servidores, cierra las ventanas de comandos.
echo.
pause 