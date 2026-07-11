import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fontFamily } from "../theme";

// 300 frames
export const Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bg = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const logoS = spring({ frame: frame - 20, fps, config: { damping: 18, stiffness: 140 } });
  const headlineOp = interpolate(frame, [45, 75], [0, 1], { extrapolateRight: "clamp" });
  const headlineY = interpolate(frame, [45, 75], [30, 0], { extrapolateRight: "clamp" });
  const urlOp = interpolate(frame, [90, 120], [0, 1], { extrapolateRight: "clamp" });
  const barW = interpolate(frame, [110, 150], [0, 600], { extrapolateRight: "clamp" });
  const subOp = interpolate(frame, [140, 170], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        fontFamily,
        background: `linear-gradient(135deg, ${colors.primary} 0%, #0F1B34 100%)`,
        alignItems: "center",
        justifyContent: "center",
        opacity: bg,
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          transform: `scale(${interpolate(logoS, [0, 1], [0.85, 1])})`,
          opacity: interpolate(logoS, [0, 1], [0, 1]),
          marginBottom: 40,
        }}
      >
        <Img src={staticFile("images/logo.png")} style={{ height: 120, width: 120, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
        <div style={{ fontSize: 108, fontWeight: 800, color: "#FFFFFF", letterSpacing: -3, lineHeight: 1 }}>
          Libre Carga
        </div>
      </div>

      <div
        style={{
          fontSize: 52,
          fontWeight: 500,
          color: "#E2E8F0",
          textAlign: "center",
          opacity: headlineOp,
          transform: `translateY(${headlineY}px)`,
          maxWidth: 1200,
          lineHeight: 1.15,
        }}
      >
        Deja el Excel. <span style={{ color: colors.accentSoft, fontWeight: 700 }}>Empieza a cobrar mejor.</span>
      </div>

      <div style={{ width: barW, height: 4, background: colors.accent, borderRadius: 2, marginTop: 48 }} />

      <div
        style={{
          marginTop: 40,
          fontSize: 72,
          fontWeight: 800,
          color: "#FFFFFF",
          letterSpacing: -2,
          opacity: urlOp,
        }}
      >
        librecarga.com
      </div>

      <div
        style={{
          marginTop: 20,
          fontSize: 26,
          color: colors.accentSoft,
          letterSpacing: 6,
          textTransform: "uppercase",
          fontWeight: 600,
          opacity: subOp,
        }}
      >
        Prueba el demo · Sin tarjeta
      </div>
    </AbsoluteFill>
  );
};
