import { supabase } from "@/integrations/supabase/client";

/**
 * S.3 (N-4): error tipado cuando la factura aún tiene REPs (complementos de pago) vivos.
 * La guarda existe en BD (`LC_FACTURA_CON_REP_VIVO`), pero un pre-check local
 * evita el roundtrip y da un mensaje accionable con el conteo exacto.
 */
export class FacturaConRepsVivosError extends Error {
  code = "LC_FACTURA_CON_REP_VIVO" as const;
  constructor(public readonly cantidad: number) {
    super(
      cantidad === 1
        ? "No se puede cancelar: la factura tiene 1 complemento de pago (REP) vigente. Cancela primero el REP."
        : `No se puede cancelar: la factura tiene ${cantidad} complementos de pago (REP) vigentes. Cancélalos primero.`,
    );
    this.name = "FacturaConRepsVivosError";
  }
}

export async function assertSinRepsVivos(facturaId: string): Promise<void> {
  try {
    const { count, error } = await supabase
      .from("pagos_factura")
      .select("id", { count: "exact", head: true })
      .eq("factura_id", facturaId)
      .not("uuid_rep", "is", null)
      .is("rep_cancelado_en", null)
      .is("deleted_at", null);
    if (error) return; // defensa temprana; si falla, la BD lo bloqueará igual
    if ((count ?? 0) > 0) throw new FacturaConRepsVivosError(count ?? 0);
  } catch (err) {
    if (err instanceof FacturaConRepsVivosError) throw err;
    // Cualquier otro error en el pre-check no debe bloquear la cancelación;
    // la guarda de BD (LC_FACTURA_CON_REP_VIVO) sigue siendo la fuente de verdad.
  }
}
