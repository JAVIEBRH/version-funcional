@echo off
echo ========================================
echo    INICIANDO BACKEND - AGUAS ANCUD
echo ========================================
echo.

cd /d "%~dp0backend"

echo Instalando dependencias...
pip install -r requirements.txt

echo.
echo Iniciando servidor backend en http://localhost:8000
echo.
uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause 