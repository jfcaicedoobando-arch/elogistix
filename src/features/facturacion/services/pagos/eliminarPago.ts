/**
 * Baja atómica de un cobro de cliente (Ola 15).
 * Extraído de `pagos/index.ts` para respetar el límite de 200 líneas.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Error tipado (Fase R.5 · Bug 8): se intentó eliminar un pago cuyo REP
 * (complemento de pago) aún está vigente (`uuid_rep IS NOT NULL AND
 * rep_cancelado_en IS NULL`). El usuario debe cancelar el REP primero.
 */
export class PagoConRepVivoError extends Error {
  readonly code = "LC_PAGO_CON_REP_VIVO" as const;
  readonly uuidRep: string | null;
  constructor(uuidRep: string | null) {
    super(
      "No se puede eliminar el pago porque tiene un complemento de pago (REP) vigente. Cancela el REP antes de eliminar el pago.",
    );
    this.name = "PagoConRepVivoError";
    this.uuidRep = uuidRep;
  }
}

function esErrorPagoConRepVivo(err: unknown): boolean {
  if (err instanceof Error) return /LC_PAGO_CON_REP_VIVO/.test(err.message);
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return /LC_PAGO_CON_REP_VIVO/.test(m);
  }
  return /LC_PAGO_CON_REP_VIVO/.test(String(err ?? ""));
}

/** Resultado de la baja atómica de un cobro. */
export interface EliminarPagoResult {
  /** Movimientos bancarios generados por el sistema dados de baja. */
  movimientosBaja: number;
  /** Movimientos importados del banco que se desvincularon y quedaron pendientes. */
  movimientosDesvinculados: number;
  yaEliminado: boolean;
}

/**
 * Ola 15: la baja del pago, la del movimiento bancario y la bitácora ocurren
 * dentro de una sola transacción en la RPC `eliminar_pago_cliente`. Antes eran
 * tres llamadas sueltas y un fallo intermedio dejaba el banco descuadrado.
 */
export async function eliminarPagoFactura(id: string): Promise<EliminarPagoResult> {
  // Defensa temprana: mensaje en español sin esperar el error de la BD (ahorra
  // ruido en Sentry). La RPC sigue siendo la fuente de verdad ante carreras.
  const { data: pago } = await supabase
    .from("pagos_factura")
    .select("id, factura_id, uuid_rep, rep_cancelado_en")
    .eq("id", id)
    .maybeSingle();
  if (pago?.uuid_rep && !pago.rep_cancelado_en) {
    throw new PagoConRepVivoError(pago.uuid_rep);
  }

  const { data, error } = await supabase.rpc("eliminar_pago_cliente", {
    _pago_id: id,
  });
  if (error) {
    if (esErrorPagoConRepVivo(error)) {
      throw new PagoConRepVivoError(pago?.uuid_rep ?? null);
    }
    throw error;
  }
  const res = (data ?? {}) as {
    movimientos_baja?: number;
    movimientos_desvinculados?: number;
    ya_eliminado?: boolean;
  };
  return {
    movimientosBaja: res.movimientos_baja ?? 0,
    movimientosDesvinculados: res.movimientos_desvinculados ?? 0,
    yaEliminado: res.ya_eliminado === true,
  };
}
