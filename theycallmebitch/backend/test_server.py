from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Test API", version="1.0")

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/test")
def test_endpoint():
    return {"message": "Server is working", "status": "OK"}

@app.get("/kpis")
def get_kpis():
    return {
        "ventas_mes": 150000,
        "ventas_mes_pasado": 120000,
        "total_pedidos_mes": 75,
        "total_pedidos_mes_pasado": 60,
        "total_litros_mes": 1500,
        "litros_vendidos_mes_pasado": 1200,
        "costos_reales": 80000,
        "iva": 15000,
        "punto_equilibrio": 40,
        "clientes_activos": 45
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001) 