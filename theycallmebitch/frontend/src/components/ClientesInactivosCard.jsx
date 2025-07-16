import React from 'react';

export default function ClientesInactivosCard({ 
  title = 'Clientes Inactivos', 
  value = 23, 
  subtitle = 'Este mes',
  percentageChange = -5.1,
  isPositive = false 
}) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      borderRadius: 8,
      padding: 16,
      color: 'white',
      boxShadow: '0 4px 16px rgba(250, 112, 154, 0.2)',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      height: 120
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: 2 }}>{title}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 }}>
            {value}
          </div>
          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{subtitle}</div>
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 6,
          padding: 6,
          fontSize: '1rem'
        }}>
          😴
        </div>
      </div>
      
      {percentageChange !== null && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: '0.7rem',
          opacity: 0.9
        }}>
          <span style={{ color: isPositive ? '#4ade80' : '#f87171' }}>
            {isPositive ? '↗' : '↘'}
          </span>
          <span>{isPositive ? '+' : ''}{percentageChange}%</span>
        </div>
      )}
    </div>
  );
} 