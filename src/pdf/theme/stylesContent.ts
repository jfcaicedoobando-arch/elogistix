/**
 * Estilos de contenido (headings, grids, badges, KPIs, notas, tablas y totales)
 * para PDFs. Bloque consumido por `src/pdf/theme/styles.ts`.
 */
import { COLORS, FONTS } from "./tokens";

export const contentStyles = {
  // Legacy headings
  h1: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.primary },
  h1Xl: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.primary, letterSpacing: 0.5 },
  numero: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.muted, marginTop: 4 },
  meta: { alignItems: "flex-end" as const, fontSize: 9, color: COLORS.muted },
  metaLine: { marginTop: 2 },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: COLORS.badgeBg,
    color: COLORS.badgeFg,
    fontSize: 8,
    fontFamily: FONTS.bold,
  },
  badgeWarning: { backgroundColor: COLORS.warningBg, color: COLORS.warningFg },
  badgeInfo: { backgroundColor: COLORS.infoBg, color: COLORS.infoFg },
  h3: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 4,
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.6,
  },
  h4: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.ink, marginTop: 10, marginBottom: 4 },
  paragraph: { marginTop: 4, marginBottom: 4 },
  notice: {
    marginTop: -4,
    marginBottom: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: COLORS.warningBg,
    color: COLORS.warningFg,
    fontSize: 8,
    fontFamily: FONTS.bold,
    textAlign: "center" as const,
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
    borderRadius: 3,
  },
  // Key/Value grid
  gridRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, marginHorizontal: -4 },
  gridCell4: { width: "25%", paddingHorizontal: 4, marginBottom: 6 },
  gridCell3: { width: "33.33%", paddingHorizontal: 4, marginBottom: 6 },
  gridCell2: { width: "50%", paddingHorizontal: 4, marginBottom: 6 },
  gridCellFull: { width: "100%", paddingHorizontal: 4, marginBottom: 6 },
  label: { fontSize: 7.5, color: COLORS.mutedLight, textTransform: "uppercase" as const, letterSpacing: 0.4 },
  value: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.ink },
  // Tabla
  table: { marginTop: 4 },
  tableHeader: { flexDirection: "row" as const, backgroundColor: COLORS.primary, alignItems: "stretch" as const },
  tableRow: {
    flexDirection: "row" as const,
    borderBottomWidth: 0.25,
    borderBottomColor: COLORS.border,
    minHeight: 18,
    alignItems: "stretch" as const,
  },
  tableRowZebra: {
    flexDirection: "row" as const,
    borderBottomWidth: 0.25,
    borderBottomColor: COLORS.border,
    minHeight: 18,
    backgroundColor: COLORS.zebra,
    alignItems: "stretch" as const,
  },
  th: {
    paddingVertical: 6,
    paddingHorizontal: 7,
    fontSize: 8.5,
    fontFamily: FONTS.bold,
    color: COLORS.primaryFg,
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
    overflow: "hidden" as const,
  },
  // Tipografía defensiva (12.61.9): `overflow: hidden` + `flexShrink: 1` evita
  // que un texto largo en una celda desplace/recorte las celdas vecinas.
  td: { paddingVertical: 5, paddingHorizontal: 7, fontSize: 9, overflow: "hidden" as const, flexShrink: 1 },
  // `minWidth: 0` es clave en flex para que el wrap real funcione cuando hay
  // strings sin espacios (URLs, IDs de contenedores concatenados, etc.).
  cellDesc: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  // Columnas numéricas: ancho fijo INVIOLABLE — `flexGrow:0` + `flexShrink:0`
  // bloquea que una descripción larga pueda comprimirlas o empujarlas.
  cellNum: { width: 65, textAlign: "right" as const, flexGrow: 0, flexShrink: 0 },
  cellNumWide: { width: 80, textAlign: "right" as const, flexGrow: 0, flexShrink: 0 },
  // Importes con divisa explícita ("USD 2,115.00"): ancho suficiente para que
  // el monto no se parta en dos líneas dentro de la celda.
  cellMoney: { width: 78, textAlign: "right" as const, flexGrow: 0, flexShrink: 0 },
  cellQty: { width: 38, textAlign: "right" as const, flexGrow: 0, flexShrink: 0 },
  subtotalBlock: { marginTop: 6, alignItems: "flex-end" as const },
  subtotalLine: { fontSize: 10, marginVertical: 1, color: COLORS.muted },
  subtotalEmphasis: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary,
    paddingTop: 3,
    marginTop: 3,
  },
  // KPIs
  kpiRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    marginTop: 6,
    marginBottom: 10,
    marginHorizontal: -3,
  },
  kpiCard: { width: "25%", paddingHorizontal: 3 },
  kpiInner: {
    backgroundColor: COLORS.zebra,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
  },
  kpiLabel: { fontSize: 7, color: COLORS.muted, textTransform: "uppercase" as const, letterSpacing: 0.4 },
  kpiValue: { fontSize: 13, fontFamily: FONTS.bold, marginTop: 3, color: COLORS.primary },
  // Notas
  notesBox: {
    marginTop: 8,
    padding: 10,
    backgroundColor: COLORS.zebra,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  // Chip "Contenedor"
  containerBlock: {
    backgroundColor: COLORS.zebra,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginTop: 12,
    marginBottom: 2,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
};
