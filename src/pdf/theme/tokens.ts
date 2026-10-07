/**
 * Tokens visuales para documentos @react-pdf/renderer.
 * Paleta corporativa alineada con la app y Inter local con licencia OFL.
 *
 * Fuente de verdad: src/index.css
 *   primary ≈ hsl(216 47% 20%) → #1B2E4B  (--primary)
 *   accent  ≈ hsl(221 83% 53%) → #2463EB  (--accent, modo claro)
 */

export const COLORS = {
  primary: "#1B2E4B",
  primaryFg: "#FFFFFF",
  accent: "#2463EB",
  ink: "#121A2B",
  muted: "#58687E",
  mutedLight: "#58687E",
  /** Gris intermedio para notas al pie y textos secundarios. */
  subtle: "#64748B",
  border: "#E5EAF0",
  borderStrong: "#CBD5E1",
  zebra: "#F8FAFC",
  surface: "#FFFFFF",
  badgeBg: "#EBF1FE",
  badgeFg: "#1B2E4B",
  warningBg: "#FEF3C7",
  warningBorder: "#D97706",
  warningFg: "#92400E",
  infoBg: "#DBEAFE",
  infoFg: "#1E3A8A",
  soft: "#EEF2F6",
  successBg: "#E8F7EF",
  successFg: "#167345",
  dangerBg: "#FFF0F0",
  dangerFg: "#B51B1B",
  // legacy alias para compatibilidad con código existente
  primaryDark: "#1B2E4B",
} as const;

/** Inter empacada localmente: misma familia que la app, sin peticiones remotas. */
export const FONTS = {
  regular: "Inter",
  bold: "Inter SemiBold",
  oblique: "Inter Italic",
} as const;
