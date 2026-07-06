import type { ProformaConFactura } from "@/features/proformas/services";
import type { Tables } from "@/types/db";

/** Detecta borradores vacíos (sin conceptos / total cero) que aún están en estado pendiente. */
export function esBorradorVacio(p: ProformaConFactura): boolean {
  return (
    (p.estado_proforma ?? "pendiente") === "pendiente" &&
    (p.estado_aprobacion ?? "aprobada") === "borrador" &&
    Number(p.total_mxn ?? 0) === 0 &&
    Number(p.total_usd ?? 0) === 0
  );
}

/**
 * Borrador "inconsistente": está en estado borrador pendiente pero no tiene
 * conceptos_venta vinculados (sin importar si el total en BD quedó con algún
 * valor manual). Este caso también dispara el aviso al usuario porque el badge
 * del header dice "PROFORMA GENERADA" pero los conceptos siguen huérfanos.
 */
export function esBorradorSinConceptos(
  p: ProformaConFactura,
  conceptos: Pick<Tables<"conceptos_venta">, "proforma_id">[],
): boolean {
  if ((p.estado_proforma ?? "pendiente") !== "pendiente") return false;
  if ((p.estado_aprobacion ?? "aprobada") !== "borrador") return false;
  return !conceptos.some((c) => c.proforma_id === p.id);
}
