import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fontFamily } from "../theme";

// 360 frames
const MODULES = [
  {
    title: "Cotizaciones",
    subtitle: "Ruta + contenedor y listo",
    rows: [
      ["SHA → MZM", "40'HC", "$3,240", "USD"],
      ["NGB → MZM", "40'HC", "$3,180", "USD"],
      ["SHA → MZM", "20'DC", "$2,050", "USD"],
    ],
    accent: colors.accent,
  },
  {
    title: "Embarques",
    subtitle: "Timeline automático",
    rows: [
      ["LC-2607", "En tránsito", "ETA 14/07", "MSC"],
      ["LC-2604", "En puerto", "MZM", "HPL"],
      ["LC-2599", "Entregado", "GDL", "ONE"],
    ],
    accent: colors.primary,
  },
  {
    title: "Bitácora",
    subtitle: "Todo queda registrado",
    rows: [
      ["Edición BL", "Héctor L.", "hace 3m"],
      ["Alta factura", "Ana G.", "hace 12m"],
      ["Cambio ETA", "Sistema", "hace 1h"],
    ],
    accent: colors.success,
  },
  {
    title: "CxC / CxP",
    subtitle: "CFDI 4.0 y complementos",
    rows: [
      ["FP-000142", "$48,320", "Pagado"],
      ["FP-000141", "$92,110", "Pendiente"],
      ["FC-000287", "$18,900", "Pagado"],
    ],
    accent: colors.warn,
  },
];

const Card: React.FC<{ mod: (typeof MODULES)[number]; delay: number }> = ({ mod, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 140 } });
  const clip = interpolate(s, [0, 1], [100, 0]);
  const y = interpolate(s, [0, 1], [40, 0]);
  const op = interpolate(frame, [delay, delay + 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 16,
        boxShadow: "0 24px 48px rgba(15,23,42,0.10)",
        padding: 32,
        border: `1px solid ${colors.line}`,
        clipPath: `inset(0 ${clip}% 0 0)`,
        opacity: op,
        transform: `translateY(${y}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 8, height: 40, background: mod.accent, borderRadius: 4 }} />
        <div>
          <div style={{ fontSize: 32, fontWeight: 700, color: colors.primary, lineHeight: 1 }}>{mod.title}</div>
          <div style={{ fontSize: 18, color: colors.muted, marginTop: 4 }}>{mod.subtitle}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {mod.rows.map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "14px 18px",
              background: i % 2 === 0 ? "#F8FAFC" : "#FFFFFF",
              borderRadius: 8,
              border: `1px solid ${colors.line}`,
              fontSize: 18,
              color: colors.text,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {row.map((cell, j) => (
              <span key={j} style={{ fontWeight: j === 0 ? 600 : 400, color: j === row.length - 1 ? mod.accent : colors.text }}>
                {cell}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const Modules: React.FC = () => {
  const frame = useCurrentFrame();
  const outOp = interpolate(frame, [330, 358], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, padding: 80, opacity: outOp }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 20, color: colors.accent, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>
          Un solo sistema
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, color: colors.primary, letterSpacing: -2, lineHeight: 1.05, marginTop: 8 }}>
          De la cotización al cobro.
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 24,
        }}
      >
        {MODULES.map((m, i) => (
          <Card key={m.title} mod={m} delay={30 + i * 22} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
