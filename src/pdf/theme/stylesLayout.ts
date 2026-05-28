/**
 * Estilos de layout/page/header/footer para PDFs.
 * Bloque consumido por `src/pdf/theme/styles.ts` para componer el StyleSheet final.
 */
import { COLORS, FONTS } from "./tokens";

export const layoutStyles = {
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 36,
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: COLORS.ink,
    lineHeight: 1.45,
  },
  // Banda superior (3pt) decorativa
  topBand: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.primary,
  },
  // Header
  header: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 14,
    marginBottom: 14,
  },
  brandBlock: { flexDirection: "column" as const },
  brandMark: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    letterSpacing: 1.5,
  },
  brandSub: {
    fontSize: 8,
    color: COLORS.mutedLight,
    marginTop: 2,
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
  },
  brandLine: { fontSize: 8, color: COLORS.muted, marginTop: 1 },
  docType: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.ink,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    textAlign: "right" as const,
  },
  docNumber: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    marginTop: 2,
    textAlign: "right" as const,
  },
  // Footer
  footer: {
    position: "absolute" as const,
    bottom: 18,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.primary,
    paddingTop: 6,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    fontSize: 7.5,
    color: COLORS.mutedLight,
  },
  pageNumber: { fontSize: 8, color: COLORS.mutedLight, marginTop: 2 },
};
