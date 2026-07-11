import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fontFamily } from "../theme";

// 180 frames. Chaotic Excel-like grid collapses. Message reveals.
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rows = 8;
  const cols = 14;

  const titleY = spring({ frame: frame - 60, fps, config: { damping: 18, stiffness: 120 } });
  const titleOpacity = interpolate(frame, [55, 80], [0, 1], { extrapolateRight: "clamp" });
  const collapse = interpolate(frame, [40, 110], [0, 1], { extrapolateRight: "clamp", easing: (t) => t * t });

  const outOpacity = interpolate(frame, [150, 178], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, opacity: outOpacity }}>
      {/* Chaotic grid */}
      <div
        style={{
          position: "absolute",
          inset: 80,
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          gap: 6,
        }}
      >
        {Array.from({ length: rows * cols }).map((_, i) => {
          const seed = (i * 9301 + 49297) % 233280;
          const rnd = seed / 233280;
          const appear = interpolate(frame, [0, 20 + rnd * 20], [0, 1], { extrapolateRight: "clamp" });
          const fall = interpolate(collapse, [0, 1], [0, 300 + rnd * 400]);
          const rot = interpolate(collapse, [0, 1], [0, (rnd - 0.5) * 40]);
          const fade = interpolate(collapse, [0, 1], [1, 0]);
          const isHeader = i < cols;
          return (
            <div
              key={i}
              style={{
                background: isHeader ? colors.primary : "#FFFFFF",
                color: isHeader ? "#FFFFFF" : colors.text,
                border: `1px solid ${colors.line}`,
                borderRadius: 2,
                opacity: appear * fade,
                transform: `translateY(${fall}px) rotate(${rot}deg)`,
                fontSize: 14,
                fontWeight: isHeader ? 700 : 400,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "monospace",
              }}
            >
              {isHeader ? ["Cliente", "BL", "ETD", "ETA", "Naviera", "Costo", "Venta", "Utilidad", "Status", "IVA", "USD/MXN", "Concepto", "Ref", "Notas"][i] : (rnd > 0.5 ? `$${Math.floor(rnd * 9999)}` : rnd > 0.2 ? `MX-${Math.floor(rnd * 99)}` : "")}
            </div>
          );
        })}
      </div>

      {/* Reveal title */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          opacity: titleOpacity,
          transform: `translateY(${interpolate(titleY, [0, 1], [40, 0])}px)`,
        }}
      >
        <div
          style={{
            padding: "32px 56px",
            background: colors.bg,
            border: `2px solid ${colors.primary}`,
            borderRadius: 8,
            boxShadow: "0 30px 60px rgba(15,23,42,0.15)",
          }}
        >
          <div style={{ fontSize: 28, color: colors.muted, fontWeight: 500, letterSpacing: 4, textTransform: "uppercase", marginBottom: 12 }}>
            El forwarding en México
          </div>
          <div style={{ fontSize: 96, color: colors.primary, fontWeight: 900, lineHeight: 1, letterSpacing: -2 }}>
            se hace en Excel.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
