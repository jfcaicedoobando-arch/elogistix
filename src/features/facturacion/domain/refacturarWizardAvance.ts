/**
 * Lógica de avance del asistente de refacturación extraída del hook para
 * mantener la complejidad ciclomática dentro del límite del proyecto.
 */
import { TOTAL_PASOS_REFACTURACION } from "@/features/facturacion/domain/refacturacionPasos";

export type AvanceArgs = {
  paso: number;
  facturaId: string | null;
  casoId: string | null;
  facturaNuevaId: string | null;
  clienteDestinoId: string | null;
  pagoSeleccionadoId: string | null;
  yaReasignado: boolean;
};

export type AvanceAccion =
  | { tipo: "nada" }
  | { tipo: "abrir" }
  | { tipo: "avanzar"; paso: number }
  | { tipo: "cerrar" }
  | { tipo: "reasignar"; pagoId: string; facturaDestinoId: string; casoId: string };

/** Decide qué mutación corresponde al paso actual sin ejecutar efectos. */
export function decidirAvance(a: AvanceArgs): AvanceAccion {
  if (a.paso === 1) {
    if (a.casoId) return { tipo: "avanzar", paso: 2 };
    if (!a.facturaId || !a.clienteDestinoId) return { tipo: "nada" };
    return { tipo: "abrir" };
  }
  if (a.paso !== TOTAL_PASOS_REFACTURACION) {
    return { tipo: "avanzar", paso: a.paso + 1 };
  }
  if (a.yaReasignado) return { tipo: "cerrar" };
  if (!a.pagoSeleccionadoId || !a.facturaNuevaId || !a.casoId) return { tipo: "nada" };
  return {
    tipo: "reasignar",
    pagoId: a.pagoSeleccionadoId,
    facturaDestinoId: a.facturaNuevaId,
    casoId: a.casoId,
  };
}
