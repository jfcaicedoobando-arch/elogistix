/**
 * Reducers puros para el estado de vínculos concepto↔factura.
 * Extraídos del hook controller para respetar Power-of-10.
 */
import type { ConceptoCostoAbierto } from "@/features/cxp/services";
import type { SeleccionLinea } from "@/features/cxp/components/VincularEmbarqueSection";
import type { VinculoLinea } from "./useNuevaFacturaProveedorForm.helpers";

export type VinculosState = Record<string, SeleccionLinea & VinculoLinea>;

export function toggleVinculoReducer(
  prev: VinculosState,
  c: ConceptoCostoAbierto,
  checked: boolean,
): VinculosState {
  const next = { ...prev };
  if (!checked) { delete next[c.id]; return next; }
  next[c.id] = {
    embarqueId: c.embarque_id,
    descripcion: c.concepto,
    monto: c.monto,
    montoOriginal: c.monto,
  };
  return next;
}

export function setVinculoMontoReducer(
  prev: VinculosState,
  conceptoId: string,
  monto: number,
): VinculosState {
  return prev[conceptoId]
    ? { ...prev, [conceptoId]: { ...prev[conceptoId], monto } }
    : prev;
}

export function aplicarSugerenciasReducer(
  sugs: ReadonlyArray<{ conceptoId: string; concepto: string; monto: number; embarque_id: string }>,
): VinculosState {
  const next: VinculosState = {};
  for (const s of sugs) {
    next[s.conceptoId] = {
      embarqueId: s.embarque_id, descripcion: s.concepto,
      monto: s.monto, montoOriginal: s.monto,
    };
  }
  return next;
}
