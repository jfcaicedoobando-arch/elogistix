/**
 * Ola 3 — Presets de retención para conceptos de factura (CFDI 4.0).
 * Cada preset lleva las tasas normalizadas 0..1 (10% → 0.10).
 *
 * Se pueden combinar (típico autotransporte: ISR 10% + IVA 4%).
 */

export type RetencionIsrKey = "ninguna" | "isr_10";
export type RetencionIvaKey = "ninguna" | "iva_4" | "iva_10_67";

export interface RetencionOption<K extends string> {
  key: K;
  label: string;
  tasa: number;
}

export const RET_ISR_OPTIONS: RetencionOption<RetencionIsrKey>[] = [
  { key: "ninguna", label: "Sin ISR", tasa: 0 },
  { key: "isr_10", label: "ISR 10%", tasa: 0.10 },
];

export const RET_IVA_OPTIONS: RetencionOption<RetencionIvaKey>[] = [
  { key: "ninguna", label: "Sin IVA ret.", tasa: 0 },
  { key: "iva_4", label: "IVA 4% (autotransporte)", tasa: 0.04 },
  { key: "iva_10_67", label: "IVA 10.6667% (2/3)", tasa: 0.106667 },
];

export function isrKeyFromTasa(tasa: number | null | undefined): RetencionIsrKey {
  return Number(tasa ?? 0) >= 0.0999 ? "isr_10" : "ninguna";
}

export function ivaKeyFromTasa(tasa: number | null | undefined): RetencionIvaKey {
  const t = Number(tasa ?? 0);
  if (t >= 0.1066 && t <= 0.1068) return "iva_10_67";
  if (t >= 0.039 && t <= 0.041) return "iva_4";
  return "ninguna";
}

export function tasaFromIsrKey(k: RetencionIsrKey): number {
  return RET_ISR_OPTIONS.find((o) => o.key === k)?.tasa ?? 0;
}

export function tasaFromIvaKey(k: RetencionIvaKey): number {
  return RET_IVA_OPTIONS.find((o) => o.key === k)?.tasa ?? 0;
}
