import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fontFamily } from "../theme";

// 360 frames — CN → MX route with timeline events
const EVENTS = [
  { at: 0.12, label: "Booking confirmado", city: "Shanghai", flag: "🇨🇳" },
  { at: 0.28, label: "Zarpe", city: "Shanghai", flag: "🇨🇳" },
  { at: 0.52, label: "En tránsito", city: "Pacífico", flag: "🌊" },
  { at: 0.74, label: "Arribo a puerto", city: "Manzanillo", flag: "🇲🇽" },
  { at: 0.92, label: "Entregado", city: "Guadalajara", flag: "🇲🇽" },
];

export const RouteScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOp = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const outOp = interpolate(frame, [330, 358], [1, 0], { extrapolateRight: "clamp" });

  const routeStart = 40;
  const routeEnd = 240;
  const progress = interpolate(frame, [routeStart, routeEnd], [0, 1], { extrapolateRight: "clamp" });

  // Ship position along a curved line
  const startX = 260;
  const endX = 1660;
  const shipX = interpolate(progress, [0, 1], [startX, endX]);
  const shipY = 540 + Math.sin(progress * Math.PI) * -60;

  return (
    <AbsoluteFill style={{ fontFamily, padding: 80, opacity: outOp }}>
      <div style={{ opacity: headerOp, marginBottom: 20 }}>
        <div style={{ fontSize: 20, color: colors.accent, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>
          Tracking en vivo
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, color: colors.primary, letterSpacing: -2, lineHeight: 1.05, marginTop: 8 }}>
          Cada evento, sin captura manual.
        </div>
      </div>

      {/* Route SVG */}
      <div style={{ position: "relative", flex: 1, marginTop: 20 }}>
        <svg width="100%" height="100%" viewBox="0 0 1760 700" style={{ overflow: "visible" }}>
          {/* Base line */}
          <path
            d={`M ${startX} 540 Q 960 340, ${endX} 540`}
            fill="none"
            stroke={colors.line}
            strokeWidth={4}
            strokeDasharray="10 10"
          />
          {/* Traveled line */}
          <path
            d={`M ${startX} 540 Q 960 340, ${endX} 540`}
            fill="none"
            stroke={colors.accent}
            strokeWidth={6}
            strokeDasharray="2000"
            strokeDashoffset={2000 - progress * 2000}
            strokeLinecap="round"
          />

          {/* Event pins */}
          {EVENTS.map((e, i) => {
            const t = e.at;
            const cx = startX + (endX - startX) * t;
            const cy = 540 + Math.sin(t * Math.PI) * -60;
            const activated = progress >= t;
            const activateFrame = routeStart + t * (routeEnd - routeStart);
            const s = spring({ frame: frame - activateFrame, fps, config: { damping: 15, stiffness: 200 } });
            const r = activated ? interpolate(s, [0, 1], [0, 16]) : 0;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={r + 8} fill={colors.accent} opacity={0.15} />
                <circle cx={cx} cy={cy} r={r} fill={colors.accent} />
              </g>
            );
          })}

          {/* Ship */}
          <g transform={`translate(${shipX - 40} ${shipY - 40})`} opacity={progress > 0 && progress < 1 ? 1 : 0}>
            <rect x={0} y={20} width={80} height={40} rx={4} fill={colors.primary} />
            <rect x={10} y={10} width={20} height={14} fill={colors.accent} />
            <rect x={34} y={10} width={20} height={14} fill={colors.accent} />
            <rect x={58} y={10} width={14} height={14} fill={colors.accent} />
          </g>
        </svg>

        {/* Event cards */}
        {EVENTS.map((e, i) => {
          const t = e.at;
          const activateFrame = routeStart + t * (routeEnd - routeStart);
          const s = spring({ frame: frame - activateFrame - 6, fps, config: { damping: 18, stiffness: 160 } });
          const op = interpolate(s, [0, 1], [0, 1]);
          const y = interpolate(s, [0, 1], [20, 0]);
          const cx = startX + (endX - startX) * t;
          const cy = 540 + Math.sin(t * Math.PI) * -60;
          const isTop = i % 2 === 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: cx - 130,
                top: isTop ? cy - 130 : cy + 40,
                width: 260,
                padding: "12px 16px",
                background: "#FFFFFF",
                border: `1px solid ${colors.line}`,
                borderLeft: `4px solid ${colors.accent}`,
                borderRadius: 8,
                boxShadow: "0 10px 20px rgba(15,23,42,0.08)",
                opacity: op,
                transform: `translateY(${y}px)`,
              }}
            >
              <div style={{ fontSize: 14, color: colors.muted, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
                {e.flag} {e.city}
              </div>
              <div style={{ fontSize: 22, color: colors.primary, fontWeight: 700, marginTop: 2 }}>{e.label}</div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div
        style={{
          marginTop: 20,
          fontSize: 22,
          color: colors.muted,
          textAlign: "center",
          opacity: interpolate(frame, [260, 290], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Bitácora, ETAs y notificaciones — generadas automáticamente.
      </div>
    </AbsoluteFill>
  );
};
