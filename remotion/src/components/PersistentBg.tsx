import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { colors } from "../theme";

export const PersistentBg: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = (frame / 1800) * 100;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bgAlt} 100%)`,
      }}
    >
      {/* Subtle horizontal shipping rails */}
      {Array.from({ length: 14 }).map((_, i) => {
        const y = (i / 14) * 1080;
        const offset = (drift * (i % 2 === 0 ? 1 : -1)) % 200;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: -200,
              right: -200,
              top: y,
              height: 1,
              transform: `translateX(${offset}px)`,
              background: `linear-gradient(90deg, transparent 0%, ${colors.line} 30%, ${colors.line} 70%, transparent 100%)`,
              opacity: 0.35,
            }}
          />
        );
      })}
      {/* Grid dots */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(${colors.line} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          opacity: 0.25,
        }}
      />
    </AbsoluteFill>
  );
};
