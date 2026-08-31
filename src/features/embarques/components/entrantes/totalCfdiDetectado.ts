import type { CfdiXmlMeta } from "@/lib/domain/cfdiXmlMeta";

/**
 * Total del CFDI leído del XML para comparar contra lo costeado: se prefiere el
 * subtotal (sin IVA, comparable con los costos) y se cae al total.
 * Vive aparte para mantener acotada la complejidad del diálogo del buzón.
 */
export function totalCfdiDetectado(meta: CfdiXmlMeta | null | undefined): number | null {
  return meta?.subTotal ?? meta?.total ?? null;
}
