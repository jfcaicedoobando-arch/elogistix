/**
 * Tokens visuales para documentos @react-pdf/renderer.
 * Paleta corporativa (primary #0F4C81) y tipografías built-in (0 KB extra).
 */

export const COLORS = {
  primary: "#0F4C81",
  primaryFg: "#FFFFFF",
  accent: "#2563EB",
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
  primaryDark: "#0F4C81",
} as const;

/** Fuentes built-in (sin Font.register: 0 KB de fonts adicionales). */
export const FONTS = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  oblique: "Helvetica-Oblique",
} as const;
