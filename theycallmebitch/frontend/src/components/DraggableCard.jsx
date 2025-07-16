import React, { useState, useRef, useEffect } from 'react';

export default function DraggableCard({ 
  children, 
  id, 
  position = { x: 0, y: 0 },
  size = { width: 'auto', height: 'auto' },
  onMove, 
  onResize,
  minSize = { width: 200, height: 150 }
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);

  const handleMouseDown = (e) => {
    if (e.target.classList.contains('resize-handle')) return;
    
    setIsDragging(true);
    const rect = cardRef.current.getBoundingClientRect();
    const containerRect = cardRef.current.parentElement.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const containerRect = cardRef.current.parentElement.getBoundingClientRect();
      const newX = e.clientX - dragOffset.x - containerRect.left;
      const newY = e.clientY - dragOffset.y - containerRect.top;
      
      onMove && onMove(id, { x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleResizeStart = (e) => {
    setIsResizing(true);
    e.stopPropagation();
  };

  const handleResize = (e) => {
    if (!isResizing) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const newWidth = Math.max(minSize.width, e.clientX - rect.left);
    const newHeight = Math.max(minSize.height, e.clientY - rect.top);
    
    onResize && onResize(id, { width: newWidth, height: newHeight });
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', isDragging ? handleMouseMove : handleResize);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', isDragging ? handleMouseMove : handleResize);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragOffset]);

  return (
    <div
      ref={cardRef}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        zIndex: isDragging || isResizing ? 1000 : 1,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: isDragging ? 'none' : 'transform 0.2s ease'
      }}
      onMouseDown={handleMouseDown}
    >
      <div style={{ 
        position: 'relative', 
        width: '100%', 
        height: '100%',
        borderRadius: 'inherit'
      }}>
        {children}
        <div
          className="resize-handle"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 20,
            height: 20,
            cursor: 'nw-resize',
            background: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: 'rgba(0, 0, 0, 0.5)'
          }}
          onMouseDown={handleResizeStart}
        >
          ↙
        </div>
      </div>
    </div>
  );
} 