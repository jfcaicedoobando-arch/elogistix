/**
 * StyleSheet centralizado para todos los documentos @react-pdf/renderer.
 * Sistema visual unificado "Libre Carga Invoice System": tokens depurados,
 * jerarquía calmada, tablas con zebra real, totales como tarjeta.
 *
 * Paleta: primary (#0F4C81) como único acento corporativo, ink para texto.
 * Tipografías: Helvetica built-in (0 KB extra).
 */
import { StyleSheet } from "@react-pdf/renderer";

export const COLORS = {
  primary: "#0F4C81",
  primaryFg: "#FFFFFF",
  accent: "#2563EB",
  ink: "#1A1A2E",
  muted: "#475569",
  mutedLight: "#94A3B8",
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

export const styles = StyleSheet.create({
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.primary,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 14,
    marginBottom: 14,
  },
  brandBlock: {
    flexDirection: "column",
  },
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
    textTransform: "uppercase",
  },
  brandLine: {
    fontSize: 8,
    color: COLORS.muted,
    marginTop: 1,
  },
  docType: {
    fontSize: 14,
    fontFamily: FONTS.bold,
    color: COLORS.ink,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "right",
  },
  docNumber: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    marginTop: 2,
    textAlign: "right",
  },
  // Legacy heading (mantenido para llamadas existentes)
  h1: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.primary },
  h1Xl: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.primary, letterSpacing: 0.5 },
  numero: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.muted, marginTop: 4 },
  meta: { alignItems: "flex-end", fontSize: 9, color: COLORS.muted },
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
  // Headings
  h3: {
    fontSize: 10,
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 4,
    marginTop: 16,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  h4: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.ink, marginTop: 10, marginBottom: 4 },
  paragraph: { marginTop: 4, marginBottom: 4 },
  // Banner ligero (avisos no invasivos)
  notice: {
    marginTop: -4,
    marginBottom: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: COLORS.warningBg,
    color: COLORS.warningFg,
    fontSize: 8,
    fontFamily: FONTS.bold,
    textAlign: "center",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    borderRadius: 3,
  },
  // Key/Value grid (Flexbox: 4 columnas, wrap)
  gridRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  gridCell4: { width: "25%", paddingHorizontal: 4, marginBottom: 6 },
  gridCell3: { width: "33.33%", paddingHorizontal: 4, marginBottom: 6 },
  gridCell2: { width: "50%", paddingHorizontal: 4, marginBottom: 6 },
  gridCellFull: { width: "100%", paddingHorizontal: 4, marginBottom: 6 },
  label: { fontSize: 7.5, color: COLORS.mutedLight, textTransform: "uppercase", letterSpacing: 0.4 },
  value: { fontSize: 10, fontFamily: FONTS.bold, color: COLORS.ink },
  // Tabla
  table: { marginTop: 4 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.25,
    borderBottomColor: COLORS.border,
    minHeight: 18,
  },
  tableRowZebra: {
    flexDirection: "row",
    borderBottomWidth: 0.25,
    borderBottomColor: COLORS.border,
    minHeight: 18,
    backgroundColor: COLORS.zebra,
  },
  th: {
    paddingVertical: 6,
    paddingHorizontal: 7,
    fontSize: 8.5,
    fontFamily: FONTS.bold,
    color: COLORS.primaryFg,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  td: { paddingVertical: 5, paddingHorizontal: 7, fontSize: 9 },
  cellDesc: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  cellNum: { width: 65, textAlign: "right" },
  cellNumWide: { width: 80, textAlign: "right" },
  cellQty: { width: 38, textAlign: "right" },
  // Totales (legacy — preferir TotalesBox)
  totalBox: {
    marginTop: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 4,
  },
  totalLine: { fontSize: 11, fontFamily: FONTS.bold, color: COLORS.primary, marginVertical: 2, textAlign: "right" },
  totalNote: { fontSize: 8, color: COLORS.mutedLight, marginTop: 6, textAlign: "right" },
  subtotalBlock: { marginTop: 6, alignItems: "flex-end" },
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
  kpiRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, marginBottom: 10, marginHorizontal: -3 },
  kpiCard: { width: "25%", paddingHorizontal: 3 },
  kpiInner: {
    backgroundColor: COLORS.zebra,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    padding: 8,
  },
  kpiLabel: { fontSize: 7, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.4 },
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
  // Aviso pie (legacy — preferir styles.notice arriba)
  warningBox: {
    marginTop: 18,
    padding: 8,
    backgroundColor: COLORS.warningBg,
    borderRadius: 3,
    color: COLORS.warningFg,
    fontFamily: FONTS.bold,
    fontSize: 9,
    textAlign: "center",
    letterSpacing: 0.4,
  },
  // Chip "Contenedor" (sin emoji)
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
    textTransform: "uppercase",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.primary,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 7.5,
    color: COLORS.mutedLight,
  },
  pageNumber: { fontSize: 8, color: COLORS.mutedLight, marginTop: 2 },
});
