import type { ProformaConFactura } from "@/features/proformas/services";

/** Detecta borradores vacíos (sin conceptos / total cero) que aún están en estado pendiente. */
export function esBorradorVacio(p: ProformaConFactura): boolean {
  return (
    (p.estado_proforma ?? "pendiente") === "pendiente" &&
    (p.estado_aprobacion ?? "aprobada") === "borrador" &&
    Number(p.total_mxn ?? 0) === 0 &&
    Number(p.total_usd ?? 0) === 0
  );
}
