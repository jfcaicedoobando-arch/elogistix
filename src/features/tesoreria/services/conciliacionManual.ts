/**
 * Movimientos bancarios capturados a mano (fuera del importador BBVA).
 * Separado de `conciliacion.ts` para respetar el límite de 200 líneas.
 */
import { supabase } from "@/integrations/supabase/client";
import { run } from "@/lib/supabase/response";
import type { Tables } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";

/** Q-15.7: alta manual de un movimiento bancario. */
export interface MovimientoManualPayload {
  cuentaBancariaId: string;
  fecha: string;
  concepto: string;
  referencia?: string;
  cargo: number;
  abono: number;
  userId: string | null;
}

/**
 * Ola E1 · N22: un movimiento bancario es cargo O abono, nunca ambos, y nunca
 * negativo. La base lo bloquea con un CHECK; aquí avisamos con un mensaje claro
 * antes de mandar el insert.
 */
export function validarCargoAbono(cargo: number, abono: number): string | null {
  if (!Number.isFinite(cargo) || !Number.isFinite(abono)) {
    return "Captura importes numéricos válidos.";
  }
  if (cargo < 0 || abono < 0) return "Los importes no pueden ser negativos.";
  if (cargo > 0 && abono > 0) {
    return "Un movimiento es cargo o abono, no los dos: deja uno de los dos importes en cero.";
  }
  if (cargo === 0 && abono === 0) {
    return "Captura el importe del cargo o del abono.";
  }
  return null;
}

export async function registrarMovimientoManual(
  input: MovimientoManualPayload,
): Promise<void> {
  const invalido = validarCargoAbono(input.cargo, input.abono);
  if (invalido) throw new Error(invalido);
  const hashDedupe = `manual-${crypto.randomUUID()}`;

  await run(
    supabase.from("bbva_movimientos").insert({
      cuenta_bancaria_id: input.cuentaBancariaId,
      fecha: input.fecha,
      concepto: input.concepto,
      referencia: input.referencia ?? "",
      cargo: input.cargo,
      abono: input.abono,
      hash_dedupe: hashDedupe,
      importado_por: input.userId,
    }),
  );
  await registrarActividad({
    modulo: "tesoreria",
    accion: "crear_movimiento_manual",
    entidadNombre: input.concepto,
    detalles: {
      cuenta_bancaria_id: input.cuentaBancariaId,
      fecha: input.fecha,
      referencia: input.referencia ?? "",
      cargo: input.cargo,
      abono: input.abono,
      hash_dedupe: hashDedupe,
    },
  });
}

/**
 * v13.444.0 — Sólo los movimientos capturados a mano (`hash_dedupe` con prefijo
 * `manual-`) pueden borrarse; los importados del estado de cuenta son append-only.
 */
export function esMovimientoManual(
  mov: Pick<Tables<"bbva_movimientos">, "hash_dedupe">,
): boolean {
  return (mov.hash_dedupe ?? "").startsWith("manual-");
}

/** Borrado lógico (soft-delete): marca `deleted_at`, nunca `.delete()`. */
export async function eliminarMovimientoManual(movId: string): Promise<void> {
  const { data, error } = await supabase
    .from("bbva_movimientos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", movId)
    .is("deleted_at", null)
    .neq("estado_conciliacion", "Conciliado")
    .like("hash_dedupe", "manual-%")
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      "No se pudo eliminar el movimiento: sólo se pueden borrar movimientos capturados a mano que no estén conciliados, y necesitas permiso de tesorería.",
    );
  }
  await registrarActividad({
    modulo: "tesoreria",
    accion: "eliminar_movimiento_manual",
    entidadId: movId,
  });
}
