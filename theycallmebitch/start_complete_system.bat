@echo off
echo ================================================
echo   INICIANDO SISTEMA COMPLETO - AGUAS ANCUD
echo ================================================
echo.

echo [1/3] Verificando dependencias...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no esta instalado o no esta en el PATH
    pause
    exit /b 1
)

echo [2/3] Iniciando Backend (Puerto 8001)...
cd backend
start "Backend - Aguas Ancud" cmd /k "python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

echo [3/3] Iniciando Frontend (Puerto 5173)...
cd ..\frontend
start "Frontend - Aguas Ancud" cmd /k "npm run dev"

echo.
echo ================================================
echo   SISTEMA INICIADO CORRECTAMENTE
echo ================================================
echo.
echo Backend:  http://localhost:8001
echo Frontend: http://localhost:5173
echo Dashboard: http://localhost:5173
echo.
echo Los servidores se mantendran ejecutandose.
echo Cierra las ventanas de terminal para detenerlos.
echo.
pause
