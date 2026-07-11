import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fontFamily } from "../theme";

// 240 frames
export const BrandReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const barW = interpolate(frame, [0, 30], [0, 200], { extrapolateRight: "clamp" });
  const logoSpring = spring({ frame: frame - 20, fps, config: { damping: 18, stiffness: 130 } });
  const logoOpacity = interpolate(frame, [18, 45], [0, 1], { extrapolateRight: "clamp" });

  const tagline = "Un sistema. Todo el forwarding.";
  const words = tagline.split(" ");

  return (
    <AbsoluteFill style={{ fontFamily, alignItems: "center", justifyContent: "center" }}>
      {/* Accent bar */}
      <div
        style={{
          width: barW,
          height: 6,
          background: colors.accent,
          borderRadius: 3,
          marginBottom: 40,
        }}
      />

      {/* Logo */}
      <div
        style={{
          opacity: logoOpacity,
          transform: `scale(${interpolate(logoSpring, [0, 1], [0.85, 1])})`,
          display: "flex",
          alignItems: "center",
          gap: 28,
          marginBottom: 48,
        }}
      >
        <Img src={staticFile("images/logo.png")} style={{ height: 140, width: 140, objectFit: "contain" }} />
        <div style={{ fontSize: 128, fontWeight: 800, color: colors.primary, letterSpacing: -4, lineHeight: 1 }}>
          Libre Carga
        </div>
      </div>

      {/* Tagline word-by-word */}
      <div style={{ display: "flex", gap: 16 }}>
        {words.map((w, i) => {
          const start = 55 + i * 8;
          const o = interpolate(frame, [start, start + 20], [0, 1], { extrapolateRight: "clamp" });
          const y = interpolate(frame, [start, start + 20], [20, 0], { extrapolateRight: "clamp" });
          return (
            <span
              key={i}
              style={{
                fontSize: 44,
                fontWeight: 500,
                color: colors.muted,
                opacity: o,
                transform: `translateY(${y}px)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>

      {/* Subtle sub-text */}
      <div
        style={{
          marginTop: 60,
          fontSize: 22,
          color: colors.accent,
          letterSpacing: 8,
          textTransform: "uppercase",
          fontWeight: 600,
          opacity: interpolate(frame, [130, 160], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        Cotizar · Operar · Cobrar · Reportar
      </div>
    </AbsoluteFill>
  );
};
