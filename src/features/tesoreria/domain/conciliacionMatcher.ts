import type { MovimientoBBVA } from "../services/conciliacion";
import type { Candidato } from "../services/sugerirCandidatos";
import { dentroDeTolerancia, deltaDiasIso } from "./tolerancia";

/**
 * Filtra candidatos que cumplen estrictamente con la tolerancia de monto y fecha.
 */
export function encontrarCandidatosExactos(
  movimiento: MovimientoBBVA,
  pagosCandidatos: Candidato[],
): Candidato[] {
  const montoMov = Number(movimiento.cargo) > 0 ? Number(movimiento.cargo) : Number(movimiento.abono);

  return pagosCandidatos.filter((p) => {
    const dMonto = dentroDeTolerancia(montoMov, p.monto);
    const dFecha = deltaDiasIso(movimiento.fecha, p.fecha) <= 5;
    return dMonto && dFecha;
  });
}

/**
 * Devuelve el único candidato si no hay ambigüedad.
 */
export function seleccionarMatchUnico(candidatos: Candidato[]): Candidato | null {
  if (candidatos.length === 1) {
    return candidatos[0];
  }
  return null;
}
