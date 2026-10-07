import { COLORS, FONTS } from "./tokens";

/** Shared presentation vocabulary: cards, scope/cutoffs and empty states. */
export const reportStyles = {
  headerIdentity: { flexDirection: "row" as const, alignItems: "flex-start" as const, marginBottom: 12 },
  issuerLogo: { width: 42, height: 30, objectFit: "contain" as const, marginRight: 10 },
  headerCategory: { fontSize: 7.5, color: COLORS.muted, paddingLeft: 12, textAlign: "right" as const, width: 100 },
  documentHeading: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "flex-start" as const },
  documentTitle: { flexGrow: 1, flexShrink: 1, minWidth: 0, paddingRight: 16 },
  documentReference: { maxWidth: "42%", flexShrink: 0, textAlign: "right" as const },
  headerMeta: { flexDirection: "row" as const, flexWrap: "wrap" as const, marginTop: 8, marginHorizontal: -4 },
  headerMetaItem: { width: "33.33%", paddingHorizontal: 4, marginBottom: 3, fontSize: 8 },
  contextBox: { padding: 9, borderWidth: 0.6, borderColor: COLORS.border, borderRadius: 5, backgroundColor: COLORS.zebra, marginBottom: 10 },
  contextText: { fontSize: 8.5, color: COLORS.muted, lineHeight: 1.4, marginBottom: 3 },
  emptyState: { fontSize: 9, color: COLORS.muted, padding: 12, marginVertical: 6, borderWidth: 0.6, borderColor: COLORS.border, borderRadius: 5, backgroundColor: COLORS.zebra },
  summaryBox: { padding: 10, backgroundColor: COLORS.soft, borderRadius: 5, marginTop: 10 },
  totalLabel: { fontSize: 9, color: COLORS.muted, flexGrow: 1, flexShrink: 1, paddingRight: 8 },
  totalAmount: { fontSize: 10, fontFamily: FONTS.bold, textAlign: "right" as const, flexShrink: 0, color: COLORS.ink },
};
