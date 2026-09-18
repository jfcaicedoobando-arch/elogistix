/**
 * Aviso informativo cuando el borrador quedó fechado en otro día que el del
 * timbre. El servidor realinea `fecha_emision` a hoy (y el trigger del DOF
 * vuelve a resolver el tipo de cambio) antes de emitir, así que esto NUNCA
 * bloquea: sólo avisa de que la factura saldrá con la fecha de hoy.
 */
import { hoyMx } from "@/lib/date/mx";

export function avisoFechaEmisionDesfasada(
  fechaEmision: string | null | undefined,
  base: Date = new Date(),
): string | null {
  const fecha = (fechaEmision ?? "").slice(0, 10);
  if (!fecha || fecha === hoyMx(base)) return null;
  return `La factura está fechada el ${fecha}. Al timbrar se emitirá con la fecha de hoy y con el tipo de cambio DOF de ese día (el SAT la certifica con la fecha del timbre).`;
}
