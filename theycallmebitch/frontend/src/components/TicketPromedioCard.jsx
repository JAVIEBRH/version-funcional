import React from 'react';

export default function TicketPromedioCard({ 
  title = 'Ticket Promedio', 
  value = 80128, 
  subtitle = 'Por pedido',
  percentageChange = 5.2,
  isPositive = true 
}) {
  const formatValue = (val) => {
    return `$${val.toLocaleString('es-CL')}`;
  };

  return (
    <div style={{
      background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
      borderRadius: 12,
      padding: 16,
      color: '#1e293b',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.08)',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      height: 120,
      border: '1px solid #e2e8f0',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Accent line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)'
      }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '0.75rem', 
            fontWeight: 500, 
            color: '#1e293b', 
            marginBottom: 4,
            letterSpacing: '0.025em',
            textTransform: 'uppercase',
            fontWeight: 600,
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            {title}
          </div>
          <div style={{ 
            fontSize: '1.5rem', 
            fontWeight: 700, 
            marginBottom: 6,
            color: '#0f172a',
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
            lineHeight: 1.1
          }}>
            {formatValue(value)}
          </div>
          <div style={{ 
            fontSize: '0.75rem', 
            color: '#1e293b',
            fontWeight: 600,
            fontFamily: '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            {subtitle}
          </div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          borderRadius: 8,
          padding: 8,
          fontSize: '1rem',
          color: 'white',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
        }}>
          🎫
        </div>
      </div>
      
      {percentageChange !== null && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: '0.75rem',
          fontWeight: 500
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            color: isPositive ? '#059669' : '#dc2626',
            background: isPositive ? '#f0fdf4' : '#fef2f2',
            padding: '2px 6px',
            borderRadius: 4,
            fontSize: '0.625rem',
            fontWeight: 600
          }}>
            <span>{isPositive ? '↗' : '↘'}</span>
            <span>{isPositive ? '+' : ''}{percentageChange.toFixed(1)}%</span>
          </div>
        </div>
      )}
    </div>
  );
} 