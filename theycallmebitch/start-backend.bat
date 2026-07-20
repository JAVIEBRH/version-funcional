@echo off
echo ========================================
echo    INICIANDO BACKEND - AGUAS ANCUD
echo ========================================
echo.

cd /d "C:\Users\Javier\Desktop\portafolio\AGUAS-ANCUD\rediseno dashboard ancud\version-funcional\theycallmebitch\backend"

echo Instalando dependencias...
pip install -r requirements.txt

echo.
echo Iniciando servidor backend en http://localhost:8001
echo.
uvicorn main:app --reload --host 0.0.0.0 --port 8001

pause 