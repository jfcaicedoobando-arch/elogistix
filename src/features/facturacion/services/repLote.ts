/**
 * Timbrado de REP (Complemento de Pagos) en lote.
 *
 * Un REP por pago: se timbra en secuencia (no en paralelo) para no saturar a
 * FacturApi ni al SAT, y un fallo NO detiene al resto — se agrega al reporte.
 */
import { emitirRep } from "@/features/facturacion/services/repFacturapi";
import { getErrorMessage } from "@/lib/errors";

export interface RepLoteFallo {
  pagoId: string;
  mensaje: string;
}

export interface RepLoteResultado {
  /** REP timbrados con éxito. */
  ok: number;
  fallos: RepLoteFallo[];
}

/** Texto es-MX del resumen para el toast ("3 REP timbrados, 1 con error"). */
export function resumenRepLote(res: RepLoteResultado): string {
  const partes: string[] = [];
  partes.push(res.ok === 1 ? "1 REP timbrado" : `${res.ok} REP timbrados`);
  if (res.fallos.length > 0) {
    partes.push(res.fallos.length === 1 ? "1 con error" : `${res.fallos.length} con error`);
  }
  return partes.join(", ");
}

/**
 * Timbra el REP de cada pago recibido, uno por uno.
 * `onProgreso` permite reflejar avance en la UI (índice 1-based).
 */
export async function timbrarRepsSecuencial(
  pagoIds: readonly string[],
  onProgreso?: (hechos: number, total: number) => void,
): Promise<RepLoteResultado> {
  const res: RepLoteResultado = { ok: 0, fallos: [] };
  let hechos = 0;

  for (const pagoId of pagoIds) {
    try {
      await emitirRep(pagoId);
      res.ok += 1;
    } catch (err) {
      res.fallos.push({ pagoId, mensaje: getErrorMessage(err) });
    }
    hechos += 1;
    onProgreso?.(hechos, pagoIds.length);
  }

  return res;
}
