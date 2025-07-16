import React from "react";
import { Card, CardContent, Typography, Box, LinearProgress } from "@mui/material";
import { TrendingUp, TrendingDown, CheckCircle, Warning } from "@mui/icons-material";
import "./KpiCard.css";

export default function PrediccionCumplimientoCard({
  prediccionEsperada,
  pedidosReales,
  fecha,
  zona,
  tipoCliente
}) {
  // Calcular porcentaje de cumplimiento
  const porcentajeCumplimiento = pedidosReales > 0 
    ? Math.round((pedidosReales / prediccionEsperada) * 100)
    : 0;

  // Determinar estado y color
  const getEstado = () => {
    if (porcentajeCumplimiento >= 90 && porcentajeCumplimiento <= 110) {
      return { estado: "Excelente", color: "#10b981", icon: <CheckCircle /> };
    } else if (porcentajeCumplimiento >= 80 && porcentajeCumplimiento <= 120) {
      return { estado: "Bueno", color: "#3b82f6", icon: <TrendingUp /> };
    } else if (porcentajeCumplimiento >= 70 && porcentajeCumplimiento <= 130) {
      return { estado: "Aceptable", color: "#f59e0b", icon: <Warning /> };
    } else {
      return { estado: "Requiere ajuste", color: "#ef4444", icon: <TrendingDown /> };
    }
  };

  const { estado, color, icon } = getEstado();

  // Calcular diferencia
  const diferencia = pedidosReales - prediccionEsperada;
  const diferenciaTexto = diferencia > 0 ? `+${diferencia}` : diferencia.toString();

  return (
    <div className="kpi-card prediccion-card">
      <div className="kpi-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="kpi-card-title">Cumplimiento Predicción</span>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {React.cloneElement(icon, { sx: { color: color, fontSize: 20 } })}
          <span style={{ 
            color: color, 
            fontSize: '0.875rem', 
            fontWeight: 600 
          }}>
            {estado}
          </span>
        </Box>
      </div>
      
      <div className="kpi-card-value" style={{ color: color }}>
        {porcentajeCumplimiento}%
      </div>
      
      <div className="kpi-card-sub">
        {pedidosReales} / {prediccionEsperada} pedidos
      </div>

      <Box sx={{ mt: 2, mb: 1 }}>
        <LinearProgress 
          variant="determinate" 
          value={Math.min(porcentajeCumplimiento, 150)} 
          sx={{ 
            height: 8, 
            borderRadius: 4,
            backgroundColor: '#e5e7eb',
            '& .MuiLinearProgress-bar': {
              backgroundColor: color,
              borderRadius: 4
            }
          }} 
        />
      </Box>

      <div className="kpi-card-desc">
        <span>
          {fecha && zona && tipoCliente ? (
            <>
              {fecha} - {zona}<br/>
              {tipoCliente}
            </>
          ) : (
            <>
              Predicción vs Real<br/>
              {diferencia !== 0 && (
                <span style={{ color: diferencia > 0 ? '#10b981' : '#ef4444' }}>
                  {diferenciaTexto} pedidos
                </span>
              )}
            </>
          )}
        </span>
      </div>
    </div>
  );
} 