/**
 * P1-3: marca el cursor de última revisión de un documento (`reconciliacion_checked_at`
 * / `rep_reconciliacion_checked_at`), incluso cuando el resultado es "sigue
 * pending" (no_change) o falla. Así el documento deja de ser el más
 * prioritario y le toca turno a otro en la siguiente corrida — evita que un
 * documento problemático (o simplemente lento de resolver en Facturapi)
 * bloquee el frente de la cola para siempre.
 */
export interface CursorSupabase {
  from: (t: string) => {
    update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => PromiseLike<unknown> };
  };
}

export async function marcarRevisado(
  supabase: CursorSupabase,
  tabla: "facturas" | "factura_notas_credito" | "pagos_factura",
  campo: "reconciliacion_checked_at" | "rep_reconciliacion_checked_at",
  id: string,
  nowIso: string,
): Promise<void> {
  await supabase.from(tabla).update({ [campo]: nowIso }).eq("id", id);
}
