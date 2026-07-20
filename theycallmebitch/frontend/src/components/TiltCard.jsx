import React, { useRef, useCallback } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Envuelve una KPI card con un efecto de flotación 3D: al mover el mouse,
// la tarjeta se inclina levemente (rotateX/rotateY) y aparece un glow
// translúcido del color `accent` que sigue al cursor. No repinta el fondo
// de la card interna — solo agrega la interacción alrededor.
const TiltCard = ({ children, accent = '#06b6d4', radius = '18px', maxTilt = 5, sx = {}, className }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const wrapperRef = useRef(null);
  const innerRef = useRef(null);
  const glowRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const px = x / rect.width;
    const py = y / rect.height;

    const rotateY = (px - 0.5) * maxTilt * 2;
    const rotateX = (0.5 - py) * maxTilt * 2;

    if (innerRef.current) {
      innerRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;
    }
    if (glowRef.current) {
      const glowOpacity = isDark ? '32' : '20';
      glowRef.current.style.background = `radial-gradient(280px circle at ${x}px ${y}px, ${accent}${glowOpacity}, transparent 68%)`;
      glowRef.current.style.opacity = '1';
    }
  }, [accent, maxTilt, isDark]);

  const handleMouseLeave = useCallback(() => {
    if (innerRef.current) {
      innerRef.current.style.transform = 'rotateX(0deg) rotateY(0deg) translateZ(0)';
    }
    if (glowRef.current) {
      glowRef.current.style.opacity = '0';
    }
  }, []);

  return (
    <Box
      ref={wrapperRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      sx={{ position: 'relative', height: '100%', perspective: '1200px', ...sx }}
    >
      <Box
        ref={innerRef}
        sx={{
          position: 'relative',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
          willChange: 'transform',
        }}
      >
        {children}
        {/* No overflow:hidden aquí a propósito: dejamos que el box-shadow/glow
            propio de la card interna siga saliendo fuera de sus bordes en hover. */}
        <Box
          ref={glowRef}
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: radius,
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 0.35s ease',
            zIndex: 5,
          }}
        />
      </Box>
    </Box>
  );
};

export default TiltCard;
