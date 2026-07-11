import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fontFamily } from "../theme";
import { AnimatedCounter } from "../components/AnimatedCounter";

// 360 frames
const KpiBig: React.FC<{ delay: number; label: string; sublabel: string; children: React.ReactNode }> = ({ delay, label, sublabel, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 22, stiffness: 140 } });
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: 40,
        borderLeft: `4px solid ${colors.accent}`,
        opacity: interpolate(s, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
      }}
    >
      <div style={{ fontSize: 20, color: colors.accent, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ fontSize: 160, fontWeight: 900, color: colors.primary, lineHeight: 1, letterSpacing: -6, fontVariantNumeric: "tabular-nums" }}>
        {children}
      </div>
      <div style={{ fontSize: 24, color: colors.muted, marginTop: 12, fontWeight: 500 }}>{sublabel}</div>
    </div>
  );
};

export const Kpis: React.FC = () => {
  const frame = useCurrentFrame();
  const headerOp = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: "clamp" });
  const outOp = interpolate(frame, [330, 358], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, padding: 80, opacity: outOp }}>
      <div style={{ opacity: headerOp, marginBottom: 30 }}>
        <div style={{ fontSize: 20, color: colors.accent, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>
          Los números
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, color: colors.primary, letterSpacing: -2, lineHeight: 1.05, marginTop: 8 }}>
          Menos clics. Más control.
        </div>
      </div>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 40, alignItems: "stretch" }}>
        <KpiBig delay={30} label="Minutos" sublabel="para cotizar un embarque">
          <Sequence from={30}>
            <AnimatedCounter from={0} to={3} duration={40} suffix=" min" />
          </Sequence>
        </KpiBig>
        <KpiBig delay={70} label="Módulos" sublabel="integrados en una sola app">
          <Sequence from={70}>
            <AnimatedCounter from={0} to={11} duration={40} />
          </Sequence>
        </KpiBig>
        <KpiBig delay={110} label="CFDI 4.0" sublabel="listo para el SAT">
          <span>✓</span>
        </KpiBig>
      </div>

      <div
        style={{
          marginTop: 30,
          display: "flex",
          gap: 40,
          justifyContent: "center",
          opacity: interpolate(frame, [180, 210], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {["SAT", "Banxico", "UN/LOCODE", "CFDI 4.0"].map((t) => (
          <div key={t} style={{ padding: "16px 32px", background: "#FFFFFF", border: `1px solid ${colors.line}`, borderRadius: 999, fontSize: 22, fontWeight: 600, color: colors.primary, letterSpacing: 1 }}>
            {t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
