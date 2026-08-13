/**
 * Claim atómico del timbrado de REP (EF-01) y re-timbrado tras cancelación
 * (Ola 12 · R3P-21).
 *
 * Antes, un REP cancelado dejaba `facturapi_rep_id` poblado y el pago quedaba
 * en dead-end (409 `ya_timbrado_rep` para siempre). Ahora, cuando el REP está
 * cancelado, el claim se toma sobre el id conocido y el REP cancelado se
 * archiva en `rep_cancelado_facturapi_id/uuid` para la posterior cancelación
 * con motivo 01 (sustitución). Si el re-timbrado falla, se restaura.
 */

/** Constructor mínimo de queries que usamos del cliente de Supabase. */
interface UpdateQuery {
  eq: (col: string, val: string) => UpdateQuery;
  is: (col: string, val: null) => UpdateQuery;
  select: (cols: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
}
type Db = {
  from: (t: string) => { update: (patch: Record<string, unknown>) => UpdateQuery };
};

export interface PagoClaimRow {
  id: string;
  estado_rep?: string | null;
  facturapi_rep_id?: string | null;
  uuid_rep?: string | null;
  rep_cancelado_facturapi_id?: string | null;
}

/** ¿El pago puede volver a timbrar aunque ya tenga `facturapi_rep_id`? */
export function esReTimbradoPermitido(pago: PagoClaimRow): boolean {
  const esClaim = String(pago.facturapi_rep_id ?? "").startsWith("PENDING:");
  if (esClaim) return false;
  return pago.estado_rep === "Cancelado"
    || (pago.estado_rep === "Error" && !!pago.rep_cancelado_facturapi_id);
}

export interface ClaimResult {
  ok: boolean;
  error?: string;
  releaseClaim: () => Promise<void>;
}

export async function tomarClaimRep(
  supabase: Db,
  pago: PagoClaimRow,
  claimTag: string,
  claimAt: string,
): Promise<ClaimResult> {
  const repAnteriorId = pago.estado_rep === "Cancelado"
    ? (pago.facturapi_rep_id ?? null)
    : (pago.rep_cancelado_facturapi_id ?? null);

  const update: Record<string, unknown> = {
    facturapi_rep_id: claimTag,
    facturapi_rep_claim_at: claimAt,
    rep_error: null,
  };
  if (pago.estado_rep === "Cancelado") {
    update.rep_cancelado_facturapi_id = pago.facturapi_rep_id ?? null;
    update.rep_cancelado_uuid = pago.uuid_rep ?? null;
  }

  let query = supabase.from("pagos_factura").update(update).eq("id", pago.id);
  query = repAnteriorId
    ? query.eq("facturapi_rep_id", repAnteriorId)
    : query.is("facturapi_rep_id", null);
  const { data: claimed, error } = await query.select("id").maybeSingle();

  const releaseClaim = async () => {
    if (repAnteriorId) {
      // R3P-21: se restaura el REP cancelado archivado — sin dead-end.
      await supabase.from("pagos_factura")
        .update({
          facturapi_rep_id: repAnteriorId,
          facturapi_rep_claim_at: null,
          estado_rep: "Cancelado",
        })
        .eq("id", pago.id)
        .eq("facturapi_rep_id", claimTag);
      return;
    }
    await supabase.from("pagos_factura")
      .update({ facturapi_rep_id: null, facturapi_rep_claim_at: null })
      .eq("id", pago.id)
      .eq("facturapi_rep_id", claimTag);
  };

  if (error) return { ok: false, error: error.message, releaseClaim };
  if (!claimed) return { ok: false, releaseClaim };
  return { ok: true, releaseClaim };
}
