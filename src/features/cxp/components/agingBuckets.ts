/**
 * Cubetas de aging para CxP. Vive aparte del componente `AgingDrillDownDialog`
 * para respetar react-refresh/only-export-components.
 */
export type CubetaAging = "vigente" | "d_1_30" | "d_31_60" | "d_61_90" | "mas_90";

export function bucketDeDias(dias: number): CubetaAging {
  if (dias <= 0) return "vigente";
  if (dias <= 30) return "d_1_30";
  if (dias <= 60) return "d_31_60";
  if (dias <= 90) return "d_61_90";
  return "mas_90";
}

export const BUCKET_LABELS: Record<CubetaAging, string> = {
  vigente: "Vigente",
  d_1_30: "1-30 d",
  d_31_60: "31-60 d",
  d_61_90: "61-90 d",
  mas_90: ">90 d",
};

import type { ChipTone } from "@/lib/ui/badgeTone";

/** Tono semántico por cubeta — consumido por `<ToneBadge tone={...} />`. */
export const BUCKET_TONE: Record<CubetaAging, ChipTone> = {
  vigente:  "neutral",
  d_1_30:   "warning",
  d_31_60:  "warning",
  d_61_90:  "destructive",
  mas_90:   "destructive",
};

