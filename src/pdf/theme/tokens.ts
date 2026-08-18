/**
 * Tokens visuales para documentos @react-pdf/renderer.
 * Paleta corporativa alineada con la app y tipografías built-in (0 KB extra).
 *
 * Fuente de verdad: src/index.css
 *   primary ≈ hsl(216 47% 20%) → #1B2E4B  (--primary)
 *   accent  ≈ hsl(221 83% 53%) → #2463EB  (--accent, modo claro)
 */

export const COLORS = {
  primary: "#1B2E4B",
  primaryFg: "#FFFFFF",
  accent: "#2463EB",
  ink: "#1A1A2E",
  muted: "#475569",
  mutedLight: "#94A3B8",
  /** Gris intermedio para notas al pie y textos secundarios. */
  subtle: "#64748B",
  border: "#E5E7EB",
  borderStrong: "#CBD5E1",
  zebra: "#F8FAFC",
  surface: "#FFFFFF",
  badgeBg: "#E0E7FF",
  badgeFg: "#3730A3",
  warningBg: "#FEF3C7",
  warningBorder: "#D97706",
  warningFg: "#92400E",
  infoBg: "#DBEAFE",
  infoFg: "#1E3A8A",
  // legacy alias para compatibilidad con código existente
  primaryDark: "#1B2E4B",
} as const;

/** Fuentes built-in (sin Font.register: 0 KB de fonts adicionales). */
export const FONTS = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  oblique: "Helvetica-Oblique",
} as const;
