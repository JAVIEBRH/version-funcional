// src/services/api.js
// Funciones para consumir la API del backend (FastAPI)

const API_URL = 'http://localhost:8000';

export async function getPedidos() {
  const res = await fetch(`${API_URL}/pedidos`);
  return await res.json();
}

export async function getClientes() {
  const res = await fetch(`${API_URL}/clientes`);
  return await res.json();
}

export async function getKpis() {
  const res = await fetch(`${API_URL}/kpis`);
  return await res.json();
}

export const getFactoresPrediccion = async () => {
  try {
    const response = await fetch(`${API_URL}/factores-prediccion`);
    if (!response.ok) {
      throw new Error('Error al obtener factores de predicción');
    }
    return await response.json();
  } catch (error) {
    console.error('Error obteniendo factores de predicción:', error);
    return {};
  }
};

export const getVentasHistoricas = async () => {
  try {
    const response = await fetch(`${API_URL}/ventas-historicas`);
    if (!response.ok) {
      throw new Error('Error al obtener ventas históricas');
    }
    return await response.json();
  } catch (error) {
    console.error('Error obteniendo ventas históricas:', error);
    return [];
  }
};

export const getVentasTotalesHistoricas = async () => {
  try {
    const response = await fetch(`${API_URL}/ventas-totales-historicas`);
    if (!response.ok) {
      throw new Error('Error al obtener ventas totales históricas');
    }
    return await response.json();
  } catch (error) {
    console.error('Error obteniendo ventas totales históricas:', error);
    return { ventas_totales: 0, total_pedidos: 0 };
  }
}; 