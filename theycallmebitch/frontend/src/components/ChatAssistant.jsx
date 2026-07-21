import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, TextField, IconButton, CircularProgress, Badge } from '@mui/material';
import { X, Send, Brain, Zap, Cpu, Copy, Check, Trash2, Maximize2, Minimize2, AlertTriangle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://backenddashboard-vh7d.onrender.com';

// Clave de localStorage donde guardamos el "snapshot" de insights ya vistos
// por el usuario (comparación por contenido, /insights no trae ids/timestamps).
const SEEN_INSIGHTS_KEY = 'ceo_chat_seen_insights';
// Intervalo de sondeo de /insights para el badge de notificación (no dispara IA,
// solo lee GLOBAL_INSIGHTS que el loop autónomo ya generó).
const INSIGHTS_POLL_MS = 60000;

const DEFAULT_GREETING = 'CEO Virtual activo. Tengo acceso completo a KPIs, segmentación RFM, zonas geográficas, clima de Puente Alto y memoria histórica. Recuerdo lo que hablamos en esta sesión. ¿Qué necesitas analizar?';

/* ── Scanning line ────────────────────────────────────────────────── */
const ScanLine = () => (
  <Box sx={{
    position: 'absolute', top: 0, left: 0, right: 0, height: '100%',
    pointerEvents: 'none', overflow: 'hidden', borderRadius: 'inherit',
    '&::after': {
      content: '""', position: 'absolute', left: 0, right: 0, height: '1px',
      background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.6), transparent)',
      animation: 'scanSweep 3.5s ease-in-out infinite',
      '@keyframes scanSweep': {
        '0%':   { top: '0%',   opacity: 0 },
        '10%':  { opacity: 1 },
        '90%':  { opacity: 1 },
        '100%': { top: '100%', opacity: 0 },
      },
    },
  }} />
);

/* ── Typing dots ──────────────────────────────────────────────────── */
const TypingDots = () => (
  <Box sx={{ display: 'flex', gap: '5px', alignItems: 'center', py: 0.5 }}>
    {[0, 1, 2].map(i => (
      <Box key={i} sx={{
        width: 5, height: 5, borderRadius: '50%',
        background: 'linear-gradient(135deg, #06b6d4, #0d9488)',
        animation: 'neuralPulse 1.4s ease-in-out infinite',
        animationDelay: `${i * 0.22}s`,
        '@keyframes neuralPulse': {
          '0%,80%,100%': { transform: 'scale(0.5)', opacity: 0.3 },
          '40%':          { transform: 'scale(1.1)', opacity: 1 },
        },
      }} />
    ))}
  </Box>
);

/* ── Markdown renderer ────────────────────────────────────────────── */
const MsgContent = ({ content, isUser }) => (
  <Box>
    {content.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <Typography key={i} sx={{
          fontSize: '0.81rem', lineHeight: 1.7,
          mb: line.trim() ? 0.4 : 0.2,
          color: isUser ? 'rgba(255,255,255,0.96)' : 'inherit',
          fontWeight: 400, fontFamily: '"DM Sans", system-ui, sans-serif',
        }}>
          {parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**')
              ? <strong key={j} style={{ fontWeight: 700, color: isUser ? '#fff' : '#06b6d4' }}>{p.slice(2,-2)}</strong>
              : p
          )}
        </Typography>
      );
    })}
  </Box>
);

/* ── Blink cursor ─────────────────────────────────────────────────── */
const BlinkCursor = () => (
  <Box component="span" sx={{
    display: 'inline-block', width: '2px', height: '14px',
    bgcolor: '#06b6d4', ml: '2px', verticalAlign: 'middle',
    animation: 'blink 1s step-end infinite',
    '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
  }} />
);

/* ── Tool name label ──────────────────────────────────────────────── */
const TOOL_LABELS = {
  get_kpis:               'Analizando KPIs...',
  get_zone_analysis:      'Revisando zonas...',
  get_customer_segments:  'Consultando clientes RFM...',
  get_trends:             'Cargando historial...',
  simulate_scenario:      'Simulando escenario...',
  draft_campaign_message: 'Redactando campaña...',
  get_daily_cashflow:     'Leyendo caja del día...',
  get_inventory:          'Revisando inventario...',
  analyze_campaign:       'Analizando campaña estratégica...',
  recommend_expansion:    'Calculando expansión mayorista...',
};

const QUICK_ACTIONS = [
  { icon: '📊', label: 'Estado del día',      query: '¿Cómo van las ventas hoy? Dame el estado de la caja del día actual con comparativa.' },
  { icon: '⚠️', label: 'Clientes en riesgo',  query: 'Dame el análisis completo de clientes en riesgo de fuga: cuántos son, cuánto revenue está en juego y diseña una campaña de reactivación con ROI.' },
  { icon: '📦', label: 'Canal mayorista',      query: 'Analiza la oportunidad de abrir un canal mayorista B2B. ¿A qué precio conviene vender, qué tipo de clientes buscar y cuánto generaría mensualmente?' },
  { icon: '📍', label: 'Zonas sin explotar',   query: 'Analiza las zonas de reparto actuales y dime qué oportunidades no estoy viendo. ¿Qué zona tiene mayor potencial sin explotar y qué haría para capturarlo?' },
];

/* ═══════════════════════════════════════════════════════════════════ */
const ChatAssistant = ({ darkMode }) => {
  const [isOpen, setIsOpen]               = useState(false);
  const [inputVal, setInputVal]           = useState('');
  const [isLoading, setIsLoading]         = useState(false);
  const [streamingContent, setStreaming]  = useState('');
  const [activeTools, setActiveTools]     = useState([]);
  const [suggestedQs, setSuggestedQs]     = useState([]);
  const [copiedId, setCopiedId]           = useState(null);
  const [feedbackId, setFeedbackId]       = useState(null);
  const [expanded,   setExpanded]         = useState(false);
  const [messages, setMessages]           = useState(() => {
    try {
      const saved = localStorage.getItem('ceo_chat_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { role: 'agent', content: DEFAULT_GREETING },
    ];
  });
  const [newInsightsCount, setNewInsightsCount] = useState(0);
  const endRef = useRef(null);
  const briefingLoadedRef = useRef(false);
  const latestInsightsRef = useRef([]);

  useEffect(() => {
    if (isOpen) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, streamingContent]);

  // Al abrir el chat por primera vez en la sesión, si no hay conversación real
  // (solo el saludo por defecto, sin historial guardado), mostrar el briefing
  // diario como primer mensaje del agente en vez del saludo genérico.
  useEffect(() => {
    if (!isOpen || briefingLoadedRef.current) return;
    briefingLoadedRef.current = true;

    const esSaludoPorDefecto = messages.length === 1 && messages[0].role === 'agent' && messages[0].content === DEFAULT_GREETING;
    if (!esSaludoPorDefecto) return;

    fetch(`${API}/briefing`)
      .then(r => r.json())
      .then(d => {
        if (d && d.briefing) {
          setMessages([{ role: 'agent', content: d.briefing }]);
        }
      })
      .catch(() => {});
  }, [isOpen]); // eslint-disable-line

  // Sondear /insights (GLOBAL_INSIGHTS) para el badge del ícono flotante.
  // /insights ya expone la lista completa de insights generados por el loop
  // autónomo (gated ahora tras anomaly_detection_service), pero no trae ids ni
  // timestamps — comparamos por contenido contra el último snapshot "visto".
  useEffect(() => {
    const checkInsights = async () => {
      try {
        const res = await fetch(`${API}/insights`);
        const data = await res.json();
        const insights = Array.isArray(data) ? data : [];
        latestInsightsRef.current = insights;

        if (insights.length === 0) {
          setNewInsightsCount(0);
          return;
        }

        let lastSeen = '';
        try { lastSeen = localStorage.getItem(SEEN_INSIGHTS_KEY) || ''; } catch {}
        const currentSnapshot = JSON.stringify(insights);

        if (currentSnapshot !== lastSeen && !isOpen) {
          setNewInsightsCount(insights.length);
        } else if (currentSnapshot === lastSeen) {
          setNewInsightsCount(0);
        }
      } catch {}
    };

    checkInsights();
    const interval = setInterval(checkInsights, INSIGHTS_POLL_MS);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Al abrir el chat, marcar los insights actuales como "vistos" y limpiar el badge.
  useEffect(() => {
    if (!isOpen) return;
    setNewInsightsCount(0);
    try {
      localStorage.setItem(SEEN_INSIGHTS_KEY, JSON.stringify(latestInsightsRef.current));
    } catch {}
  }, [isOpen]);

  // Persistir historial en localStorage (últimos 30 mensajes)
  useEffect(() => {
    try {
      localStorage.setItem('ceo_chat_history', JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  /* ── Copy handler ─────────────────────────────────────────────── */
  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  /* ── Feedback handler ─────────────────────────────────────────── */
  const handleFeedback = async (ejecutada, resultado = '') => {
    if (!feedbackId) return;
    setFeedbackId(null);
    try {
      await fetch(`${API}/recommendations/${feedbackId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ejecutada, resultado }),
      });
    } catch {}
  };

  /* ── Escuchar acciones desde alertas autónomas ───────────────── */
  useEffect(() => {
    const handler = (e) => {
      const query = e.detail?.query;
      if (!query) return;
      setIsOpen(true);
      setExpanded(true);
      // pequeño delay para que el panel abra antes de enviar
      setTimeout(() => sendQuery(query), 120);
    };
    window.addEventListener('ceo-chat-action', handler);
    return () => window.removeEventListener('ceo-chat-action', handler);
  }, [isLoading]); // eslint-disable-line

  /* ── Send message with streaming ─────────────────────────────── */
  const sendQuery = async (forcedMsg) => {
    const msg = forcedMsg || inputVal.trim();
    if (!msg || isLoading) return;
    if (!forcedMsg) setInputVal('');
    const currentHistory = [...messages];
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsLoading(true);
    setStreaming('');
    setActiveTools([]);
    setSuggestedQs([]);
    setFeedbackId(null);

    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: currentHistory }),
      });

      if (!res.ok || !res.body) throw new Error('stream_failed');

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated   = '';
      let toolsActivated = [];
      let isCampaign    = false;
      let recId         = null;
      let streamError   = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text  = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;
          try {
            const parsed = JSON.parse(raw);

            if (parsed.token) {
              accumulated += parsed.token;
              setStreaming(accumulated);
            }
            if (parsed.tool) {
              toolsActivated = [...toolsActivated, parsed.tool];
              setActiveTools([...toolsActivated]);
            }
            if (parsed.suggested_questions) {
              setSuggestedQs(parsed.suggested_questions.slice(0, 3));
            }
            if (parsed.meta) {
              isCampaign = parsed.meta.is_campaign || false;
              recId      = parsed.meta.rec_id || null;
            }
            if (parsed.error) {
              accumulated = 'Error de conexión con el servicio estratégico.';
              streamError = true;
            }
          } catch {}
        }
      }

      // Finalizar: mover streaming a messages
      setMessages(prev => [...prev, {
        role:       'agent',
        content:    accumulated || 'Error procesando respuesta.',
        isCampaign: isCampaign,
        toolsUsed:  toolsActivated,
        recId:      recId,
        isError:    streamError,
      }]);
      setStreaming('');
      setActiveTools([]);

      // Activar feedback si hubo herramienta de acción
      if (recId || toolsActivated.some(t => ['draft_campaign_message', 'simulate_scenario'].includes(t))) {
        setFeedbackId(recId);
      }

    } catch {
      // Fallback al endpoint no-streaming
      try {
        const res2 = await fetch(`${API}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, history: currentHistory }),
        });
        const data = await res2.json();
        const esError = data.response && typeof data.response === 'object' && data.response.error;
        const fallbackRecId = data.rec_id || null;
        setMessages(prev => [...prev, {
          role: 'agent',
          content: esError ? data.response.mensaje : data.response,
          isError: !!esError,
          recId: fallbackRecId,
        }]);
        if (fallbackRecId) setFeedbackId(fallbackRecId);
      } catch {
        setMessages(prev => [...prev, { role: 'agent', content: 'Error de conexión con el servicio estratégico.', isError: true }]);
      }
      setStreaming('');
      setActiveTools([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(); }
  };

  /* ── Floating button ──────────────────────────────────────────── */
  if (!isOpen) return (
    <Badge
      badgeContent={newInsightsCount}
      max={9}
      overlap="circular"
      sx={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
        '& .MuiBadge-badge': {
          bgcolor: '#f59e0b', color: '#020814', fontWeight: 800,
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          boxShadow: '0 0 0 2px rgba(4,10,20,0.98), 0 2px 8px rgba(245,158,11,0.5)',
          animation: newInsightsCount > 0 ? 'badgePulse 1.6s ease-in-out infinite' : 'none',
          '@keyframes badgePulse': {
            '0%,100%': { transform: 'scale(1)' },
            '50%':     { transform: 'scale(1.15)' },
          },
        },
      }}
    >
      <Box onClick={() => setIsOpen(true)} sx={{
        position: 'relative',
        width: 58, height: 58, borderRadius: '50%',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #06b6d4 0%, #0d9488 100%)',
        boxShadow: '0 0 0 1px rgba(6,182,212,0.35), 0 8px 32px rgba(6,182,212,0.3), 0 4px 12px rgba(0,0,0,0.4)',
        transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease',
        '&:hover': {
          transform: 'scale(1.12)',
          boxShadow: '0 0 0 2px rgba(6,182,212,0.5), 0 12px 40px rgba(6,182,212,0.4), 0 4px 16px rgba(0,0,0,0.5)',
        },
        '&::before': {
          content: '""', position: 'absolute', inset: -5, borderRadius: '50%',
          border: '1.5px solid rgba(6,182,212,0.35)',
          animation: 'pulseRing 2.8s ease-out infinite',
          '@keyframes pulseRing': {
            '0%':   { transform: 'scale(1)',   opacity: 0.7 },
            '100%': { transform: 'scale(1.6)', opacity: 0   },
          },
        },
        '&::after': {
          content: '""', position: 'absolute', inset: -10, borderRadius: '50%',
          border: '1px solid rgba(13,148,136,0.2)',
          animation: 'pulseRing 2.8s ease-out infinite 0.8s',
        },
      }}>
        <Brain size={23} color="#020814" strokeWidth={2.4} />
      </Box>
    </Badge>
  );

  /* ── Open panel ───────────────────────────────────────────────── */
  return (
    <Box sx={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      width:  expanded ? 620 : 390,
      height: expanded ? 720 : 580,
      transition: 'width 0.35s cubic-bezier(0.34,1.56,0.64,1), height 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', borderRadius: '20px',
      animation: 'panelOpen 0.4s cubic-bezier(0.34,1.56,0.64,1) both',
      '@keyframes panelOpen': {
        from: { opacity: 0, transform: 'scale(0.82) translateY(24px)' },
        to:   { opacity: 1, transform: 'scale(1) translateY(0)'       },
      },
      background: 'rgba(4,10,20,0.98)',
      backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      border: '1px solid rgba(6,182,212,0.22)',
      boxShadow: '0 0 0 1px rgba(6,182,212,0.06), 0 32px 80px rgba(0,0,0,0.75), 0 8px 24px rgba(6,182,212,0.1)',
    }}>

      {/* Header */}
      <Box sx={{
        px: 2.5, py: 1.75,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(6,182,212,0.12)',
        background: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(139,92,246,0.07) 100%)',
        flexShrink: 0, position: 'relative', overflow: 'hidden',
      }}>
        <ScanLine />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, position: 'relative', zIndex: 1 }}>
          <Box sx={{
            width: 34, height: 34, borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(13,148,136,0.2))',
            border: '1px solid rgba(6,182,212,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(6,182,212,0.25)',
          }}>
            <Brain size={17} color="#06b6d4" strokeWidth={2.2} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography sx={{
                fontSize: '0.86rem', fontWeight: 800, letterSpacing: '-0.01em',
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', color: '#e2e8f0',
              }}>
                CEO Virtual
              </Typography>
              <Box sx={{
                px: 0.75, py: 0.15, borderRadius: '5px',
                background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(13,148,136,0.15))',
                border: '1px solid rgba(6,182,212,0.3)',
              }}>
                <Typography sx={{
                  fontSize: '0.55rem', fontWeight: 800, color: '#06b6d4',
                  letterSpacing: '0.1em', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                }}>
                  MODO DIOS
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 0.2 }}>
              <Box sx={{
                width: 5, height: 5, borderRadius: '50%', bgcolor: '#10b981',
                animation: 'statusPing 2s ease-in-out infinite',
                '@keyframes statusPing': {
                  '0%,100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0.6)' },
                  '50%':     { boxShadow: '0 0 0 4px rgba(16,185,129,0)' },
                },
              }} />
              <Typography sx={{ fontSize: '0.63rem', color: '#10b981', fontWeight: 600, fontFamily: '"DM Sans", system-ui, sans-serif' }}>
                Online · Modo Dios
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, position: 'relative', zIndex: 1 }}>
          {/* Expandir / contraer */}
          <IconButton
            size="small"
            onClick={() => setExpanded(e => !e)}
            title={expanded ? 'Contraer panel' : 'Expandir panel'}
            sx={{ width: 28, height: 28, color: 'rgba(255,255,255,0.25)', borderRadius: '8px',
                  '&:hover': { bgcolor: 'rgba(6,182,212,0.1)', color: '#06b6d4' } }}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </IconButton>
          {/* Limpiar historial */}
          <IconButton
            size="small"
            title="Limpiar historial"
            onClick={() => {
              setMessages([{ role: 'agent', content: 'Historial borrado. CEO Virtual listo. ¿Qué analizamos?' }]);
              localStorage.removeItem('ceo_chat_history');
            }}
            sx={{ width: 28, height: 28, color: 'rgba(255,255,255,0.25)', borderRadius: '8px',
                  '&:hover': { bgcolor: 'rgba(239,68,68,0.1)', color: '#f87171' } }}
          >
            <Trash2 size={13} />
          </IconButton>
          {/* Cerrar */}
          <IconButton size="small" onClick={() => setIsOpen(false)} sx={{
            width: 28, height: 28, color: 'rgba(255,255,255,0.3)',
            borderRadius: '8px',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#e2e8f0' },
          }}>
            <X size={15} />
          </IconButton>
        </Box>
      </Box>

      {/* Messages */}
      <Box sx={{
        flexGrow: 1, overflowY: 'auto', px: 2, py: 1.75,
        display: 'flex', flexDirection: 'column', gap: 1.5,
        '&::-webkit-scrollbar': { width: '3px' },
        '&::-webkit-scrollbar-thumb': { background: 'rgba(6,182,212,0.2)', borderRadius: '99px' },
      }}>

        {/* Quick actions — solo cuando no hay conversación real */}
        {messages.length <= 1 && !isLoading && (
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{
              fontSize: '0.58rem', fontWeight: 700, color: 'rgba(255,255,255,0.22)',
              textTransform: 'uppercase', letterSpacing: '0.12em', mb: 1,
              fontFamily: '"Plus Jakarta Sans", system-ui',
            }}>
              Acciones rápidas
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.65 }}>
              {QUICK_ACTIONS.map((a, i) => (
                <Box
                  key={i}
                  onClick={() => setInputVal(a.query)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.25,
                    px: 1.25, py: 0.9, borderRadius: '10px', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: 'rgba(6,182,212,0.07)',
                      borderColor: 'rgba(6,182,212,0.2)',
                      transform: 'translateX(4px)',
                    },
                    '&:active': { transform: 'translateX(2px) scale(0.99)' },
                  }}
                >
                  <Typography sx={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0, userSelect: 'none' }}>
                    {a.icon}
                  </Typography>
                  <Typography sx={{
                    fontSize: '0.76rem', fontWeight: 600, color: '#94a3b8',
                    fontFamily: '"Plus Jakarta Sans", system-ui', lineHeight: 1.3,
                  }}>
                    {a.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {messages.map((m, i) => (
          <Box key={i} sx={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: 0.3,
            animation: 'msgIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
            '@keyframes msgIn': {
              from: { opacity: 0, transform: m.role === 'user' ? 'translateX(12px)' : 'translateX(-12px)' },
              to:   { opacity: 1, transform: 'translateX(0)' },
            },
          }}>
            {m.role === 'agent' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.75 }}>
                {m.isError
                  ? <AlertTriangle size={10} color="#f59e0b" />
                  : <Cpu size={10} color="#06b6d4" />}
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: m.isError ? '#f59e0b' : '#06b6d4', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                  {m.isError ? 'CEO · IA · Error' : 'CEO · IA'}
                </Typography>
                {m.toolsUsed?.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.4, ml: 0.5 }}>
                    {m.toolsUsed.slice(0, 3).map((t, ti) => (
                      <Box key={ti} sx={{
                        px: 0.5, py: 0.1, borderRadius: '3px',
                        background: 'rgba(13,148,136,0.15)',
                        border: '1px solid rgba(13,148,136,0.2)',
                      }}>
                        <Typography sx={{ fontSize: '0.5rem', color: '#14b8a6', fontFamily: '"DM Sans", system-ui' }}>
                          {t.replace('get_', '').replace('_', ' ')}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            <Box sx={{
              px: 1.75, py: 1.25,
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user'
                ? 'linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #0ea5e9 100%)'
                : m.isError ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.04)',
              border: m.role === 'user'
                ? 'none'
                : m.isError ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(6,182,212,0.12)',
              boxShadow: m.role === 'user'
                ? '0 4px 16px rgba(6,182,212,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
                : '0 2px 8px rgba(0,0,0,0.2)',
              color: m.role === 'user' ? '#fff' : m.isError ? '#fbbf24' : '#cbd5e1',
              ...(m.role === 'agent' && { borderLeft: `2px solid ${m.isError ? 'rgba(245,158,11,0.6)' : 'rgba(6,182,212,0.4)'}` }),
            }}>
              <MsgContent content={m.content} isUser={m.role === 'user'} />
            </Box>

            {/* Copy campaign button */}
            {m.isCampaign && m.role === 'agent' && (
              <Box
                onClick={() => handleCopy(m.content, i)}
                sx={{
                  mt: 0.25, ml: 0.75,
                  display: 'inline-flex', alignItems: 'center', gap: 0.5,
                  px: 1, py: 0.35, borderRadius: '6px', cursor: 'pointer',
                  border: '1px solid rgba(16,185,129,0.3)',
                  background: 'rgba(16,185,129,0.08)',
                  width: 'fit-content',
                  '&:hover': { background: 'rgba(16,185,129,0.15)' },
                  transition: 'all 0.2s',
                }}
              >
                {copiedId === i
                  ? <><Check size={10} color="#10b981" /><Typography sx={{ fontSize: '0.65rem', color: '#10b981' }}>¡Copiado!</Typography></>
                  : <><Copy size={10} color="#10b981" /><Typography sx={{ fontSize: '0.65rem', color: '#10b981' }}>Copiar mensaje WhatsApp</Typography></>
                }
              </Box>
            )}

            {/* Suggested questions after last agent message */}
            {m.role === 'agent' && i === messages.length - 1 && suggestedQs.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5, ml: 0.75 }}>
                {suggestedQs.map((q, qi) => (
                  <Box
                    key={qi}
                    onClick={() => setInputVal(q)}
                    sx={{
                      px: 1.25, py: 0.5, borderRadius: '8px', cursor: 'pointer',
                      border: '1px solid rgba(13,148,136,0.2)',
                      background: 'rgba(13,148,136,0.06)',
                      '&:hover': { background: 'rgba(13,148,136,0.12)' },
                      transition: 'background 0.2s',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.71rem', color: '#14b8a6', fontFamily: '"DM Sans", system-ui' }}>
                      {q}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        ))}

        {/* Feedback prompt */}
        {feedbackId !== null && (
          <Box sx={{
            alignSelf: 'flex-start', ml: 0.75,
            display: 'flex', alignItems: 'center', gap: 0.75,
            animation: 'msgIn 0.3s ease both',
          }}>
            <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: '"DM Sans", system-ui' }}>
              ¿Lo ejecutaste?
            </Typography>
            <Box onClick={() => handleFeedback(true, 'ejecutado')} sx={{
              px: 0.75, py: 0.25, borderRadius: '5px', cursor: 'pointer',
              border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.07)',
              '&:hover': { background: 'rgba(16,185,129,0.18)' },
            }}>
              <Typography sx={{ fontSize: '0.63rem', color: '#10b981' }}>✓ Sí</Typography>
            </Box>
            <Box onClick={() => handleFeedback(false, 'no ejecutado')} sx={{
              px: 0.75, py: 0.25, borderRadius: '5px', cursor: 'pointer',
              border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)',
              '&:hover': { background: 'rgba(239,68,68,0.18)' },
            }}>
              <Typography sx={{ fontSize: '0.63rem', color: '#f87171' }}>✗ No</Typography>
            </Box>
            <Box onClick={() => setFeedbackId(null)} sx={{ cursor: 'pointer', opacity: 0.4, ml: 0.25, '&:hover': { opacity: 0.7 } }}>
              <Typography sx={{ fontSize: '0.6rem', color: '#94a3b8' }}>×</Typography>
            </Box>
          </Box>
        )}

        {/* Streaming bubble */}
        {streamingContent && (
          <Box sx={{ alignSelf: 'flex-start', maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: 0.3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.75 }}>
              <Cpu size={10} color="#06b6d4" />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#06b6d4', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: '"Plus Jakarta Sans", system-ui' }}>
                CEO · IA
              </Typography>
            </Box>
            <Box sx={{
              px: 1.75, py: 1.25, borderRadius: '16px 16px 16px 4px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(6,182,212,0.12)',
              borderLeft: '2px solid rgba(6,182,212,0.4)',
              color: '#cbd5e1',
            }}>
              <MsgContent content={streamingContent} isUser={false} />
              <BlinkCursor />
            </Box>
          </Box>
        )}

        {/* Loading + active tools */}
        {isLoading && !streamingContent && (
          <Box sx={{ alignSelf: 'flex-start', maxWidth: '60%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.75, mb: 0.3 }}>
              <Cpu size={10} color="#06b6d4" />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: activeTools.length > 0 ? '#0d9488' : '#06b6d4', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: '"Plus Jakarta Sans", system-ui' }}>
                {activeTools.length > 0
                  ? (TOOL_LABELS[activeTools[activeTools.length - 1]] || 'Procesando...')
                  : 'Procesando...'}
              </Typography>
            </Box>
            <Box sx={{
              px: 1.75, py: 1.25, borderRadius: '16px 16px 16px 4px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(6,182,212,0.12)',
              borderLeft: `2px solid ${activeTools.length > 0 ? 'rgba(139,92,246,0.5)' : 'rgba(6,182,212,0.4)'}`,
            }}>
              <TypingDots />
            </Box>
          </Box>
        )}

        <div ref={endRef} />
      </Box>

      {/* Input area */}
      <Box sx={{
        px: 1.75, py: 1.25,
        borderTop: '1px solid rgba(6,182,212,0.1)',
        display: 'flex', alignItems: 'center', gap: 1,
        background: 'rgba(0,0,0,0.4)', flexShrink: 0,
      }}>
        <Typography sx={{
          fontSize: '0.85rem', color: '#06b6d4', fontFamily: '"JetBrains Mono", monospace',
          fontWeight: 700, flexShrink: 0, opacity: 0.7, userSelect: 'none',
        }}>
          ›
        </Typography>
        <TextField
          fullWidth size="small" multiline maxRows={3}
          placeholder="Consulta al CEO virtual..."
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKey}
          disabled={isLoading}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px', fontSize: '0.81rem',
              fontFamily: '"DM Sans", system-ui, sans-serif',
              background: 'rgba(255,255,255,0.035)',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.07)' },
              '&:hover fieldset': { borderColor: 'rgba(6,182,212,0.3)' },
              '&.Mui-focused fieldset': { borderColor: 'rgba(6,182,212,0.55)', borderWidth: 1 },
            },
            '& .MuiOutlinedInput-input': {
              color: '#cbd5e1', fontFamily: '"DM Sans", system-ui, sans-serif',
              '&::placeholder': { color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' },
            },
          }}
        />
        <IconButton
          onClick={sendQuery}
          disabled={!inputVal.trim() || isLoading}
          sx={{
            width: 36, height: 36, flexShrink: 0,
            background: !inputVal.trim() || isLoading
              ? 'rgba(255,255,255,0.05)'
              : 'linear-gradient(135deg, #0891b2, #06b6d4)',
            borderRadius: '10px',
            border: !inputVal.trim() || isLoading
              ? '1px solid rgba(255,255,255,0.06)'
              : '1px solid rgba(6,182,212,0.4)',
            color: !inputVal.trim() || isLoading ? 'rgba(255,255,255,0.18)' : '#020814',
            transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            '&:not(:disabled):hover': {
              transform: 'scale(1.1)',
              boxShadow: '0 4px 16px rgba(6,182,212,0.4)',
            },
          }}
        >
          {isLoading
            ? <CircularProgress size={13} sx={{ color: 'rgba(6,182,212,0.5)' }} />
            : <Send size={14} strokeWidth={2.5} />
          }
        </IconButton>
      </Box>
    </Box>
  );
};

export default ChatAssistant;
