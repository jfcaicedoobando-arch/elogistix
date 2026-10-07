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
    lineHeight: 1.4,
  },
  // Banda superior (4pt) decorativa
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
    flexDirection: "column" as const,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
    marginBottom: 14,
  },
  brandBlock: { flexDirection: "column" as const, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  brandMark: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    letterSpacing: 0,
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
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    lineHeight: 1.15,
    letterSpacing: -0.3,
  },
  docNumber: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    marginTop: 2,
    textAlign: "right" as const,
  },
  continuationReference: {
    position: "absolute" as const,
    top: 18,
    left: 36,
    right: 36,
    fontSize: 8,
    lineHeight: 1.1,
    color: COLORS.muted,
    maxLines: 1,
  },
  // Footer
  // R184-PDF-01: se ancla con `top` porcentual en lugar de `bottom`.
  // Con `bottom` (y sin altura explícita) el motor resuelve la posición del
  // nodo absoluto fuera de la hoja (top negativo) y el pie no se dibuja; al
  // fijar una altura, el texto dinámico de paginación (`render`) desaparece.
  // Un `top` porcentual funciona en retrato y horizontal sin cambiar de motor.
  footer: {
    position: "absolute" as const,
    top: "94.5%",
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.borderStrong,
    paddingTop: 6,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    fontSize: 7.5,
    color: COLORS.mutedLight,
  },
  // Columnas del pie con ancho explícito: dentro de un contenedor absoluto
  // el ancho automático colapsa y el contenido no se dibuja.
  footerColLeft: { width: "50%" as const, paddingRight: 6 },
  footerColCenter: { width: "26%" as const, textAlign: "center" as const },
  footerColRight: { width: "24%" as const, textAlign: "right" as const },
  pageNumber: { fontSize: 8, color: COLORS.mutedLight, marginTop: 2 },

};
