/**
 * Acciones de vinculación concepto↔factura para el hook de captura.
 * Extraídas para respetar Power-of-10 (≤200 líneas por archivo).
 */
import type { Dispatch, SetStateAction } from "react";
import type { ConceptoCostoAbierto } from "@/features/cxp/services";
import {
  aplicarSugerenciasReducer,
  setVinculoMontoReducer,
  toggleVinculoReducer,
  type VinculosState,
} from "./useNuevaFacturaProveedorForm.vinculos";

export type SugerenciaAplicable = {
  conceptoId: string; concepto: string; monto: number; embarque_id: string;
};

export function crearAccionesVinculos(
  setVinculos: Dispatch<SetStateAction<VinculosState>>,
) {
  return {
    toggleVinculo: (c: ConceptoCostoAbierto, checked: boolean) =>
      setVinculos((prev) => toggleVinculoReducer(prev, c, checked)),
    setVinculoMonto: (conceptoId: string, monto: number) =>
      setVinculos((prev) => setVinculoMontoReducer(prev, conceptoId, monto)),
    aplicarSugerencias: (sugs: ReadonlyArray<SugerenciaAplicable>) =>
      setVinculos(() => aplicarSugerenciasReducer(sugs)),
  };
}
