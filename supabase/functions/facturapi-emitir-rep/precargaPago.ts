/**
 * Carga del pago a timbrar + candado de "ya timbrado" + autorización de rol.
 * Extraído de `index.ts` (Power of 10: líneas por función); sin cambios de
 * comportamiento.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authorizeOrgRole, ROLES_COBRANZA_FISCAL } from "../_shared/auth.ts";
import { esReTimbradoPermitido } from "./claimRep.ts";
import type { PagoRep } from "./etapaDatos.ts";

const COLS_PAGO =
  "id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, forma_pago, referencia, estado_rep, facturapi_rep_id, uuid_rep, rep_cancelado_facturapi_id, monto_aplicado_factura";

export async function precargarPagoRep(
  supabase: SupabaseClient,
  pagoId: string,
  userId: string,
  json: (body: unknown, status?: number) => Response,
): Promise<{ response: Response } | { pago: PagoRep }> {
  const { data: pago, error: pErr } = await supabase
    .from("pagos_factura").select(COLS_PAGO).eq("id", pagoId).maybeSingle();
  if (pErr || !pago) return { response: json({ error: "pago_not_found", detail: pErr?.message }, 404) };

  // Ola 12 · R3P-21: un REP cancelado no es un candado — el pago puede
  // re-timbrar y el REP anterior se archiva para la sustitución motivo 01.
  if (pago.facturapi_rep_id && !esReTimbradoPermitido(pago)) {
    const esClaim = String(pago.facturapi_rep_id).startsWith("PENDING:");
    return {
      response: json({
        error: "ya_timbrado_rep",
        message: esClaim
          ? "Hay un timbrado de REP en curso o interrumpido. Espera ~3 min y usa 'Recuperar timbrado'."
          : "Este pago ya tiene REP timbrado.",
        claim_pendiente: esClaim,
      }, 409),
    };
  }

  if (!(await authorizeOrgRole(supabase, userId, pago.organization_id, ROLES_COBRANZA_FISCAL))) {
    return { response: json({ error: "forbidden" }, 403) };
  }
  return { pago: pago as unknown as PagoRep };
}
