@echo off
echo ================================================
echo   INICIANDO BACKEND - AGUAS ANCUD
echo ================================================
echo.

cd /d "C:\Users\Javier\Desktop\proyectoreatc\theycallmebitch\backend"

echo Verificando Python...
python --version
if errorlevel 1 (
    echo ERROR: Python no esta disponible
    pause
    exit /b 1
)

echo.
echo Verificando dependencias...
python -c "import fastapi, uvicorn, pandas, numpy, requests; print('Dependencias OK')"
if errorlevel 1 (
    echo ERROR: Faltan dependencias
    echo Instalando dependencias...
    pip install -r requirements.txt
)

echo.
echo Iniciando servidor backend...
echo Backend: http://localhost:8001
echo Documentacion: http://localhost:8001/docs
echo.

python main.py

pause


