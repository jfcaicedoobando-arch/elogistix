/**
 * Etapa 4 — Claim atómico, timbrado y persistencia del REP.
 *
 * Orden y garantías idénticos a los que vivían en `index.ts`:
 *  - EF-01: claim atómico ANTES de timbrar (después de validar, para no
 *    liberarlo en el 422). El tag viaja como `external_id` a FacturAPI.
 *  - P0-B: `idempotency_key` es el dedup oficial de FacturAPI (mismo claim ⇒
 *    misma llave, así un reintento técnico no crea un segundo REP).
 *  - P0-A: pendiente ⇒ 202, sin marcar Timbrado, sin XML y conservando el claim.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildRepPayload, type PagoContext } from "./helpers.ts";
import { reservarRep } from "./claimRep.ts";
import { timbrarRep } from "./timbrar.ts";
import { respuestaSiRepPendiente } from "./pendiente.ts";
import { persistirRepTimbrado } from "./persistir.ts";
import type { PagoRep } from "./etapaDatos.ts";
import type { JsonFn, UsuarioRep } from "./etapaResultado.ts";

interface ArgsEmision {
  supabase: SupabaseClient;
  /** Cliente opaco del SDK v5; lo tipa el adaptador `_shared/facturapiSdk.ts`. */
  facturapi: object;
  apiKey: string;
  ambiente: string;
  pago: PagoRep;
  facturaId: string;
  ctx: PagoContext;
  usuario: UsuarioRep;
  json: JsonFn;
}

export async function emitirRepYPersistir(args: ArgsEmision): Promise<Response> {
  const { supabase, pago, ctx, usuario, json } = args;

  const reserva = await reservarRep(supabase, pago, json);
  if ("response" in reserva) return reserva.response;
  const { claimTag, releaseClaim } = reserva;

  // EF-01: `external_id` correlaciona el claim para facturapi-recuperar-claim.
  const payload = Object.assign(buildRepPayload(ctx), {
    external_id: claimTag, idempotency_key: claimTag,
  });
  // El complemento SIEMPRE viaja estructurado (`complements[].type = "pago"`);
  // el ObjetoImpDR se declara en `related_documents[].taxability`.
  const resultado = await timbrarRep({
    facturapi: args.facturapi,
    payload,
    supabase,
    pagoId: pago.id,
    organizationId: pago.organization_id,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    claimTag,
    releaseClaim,
    json,
  });
  if (!resultado.ok) return resultado.response;

  const pend = await respuestaSiRepPendiente(resultado.invoice, {
    supabase, pagoId: pago.id, organizationId: pago.organization_id, claimTag,
    usuarioId: usuario.id, usuarioEmail: usuario.email, json,
  });
  if (pend) return pend;

  return await persistirRepTimbrado({
    supabase,
    invoice: resultado.invoice,
    apiKey: args.apiKey,
    ambiente: args.ambiente,
    claimTag,
    pagoId: pago.id,
    facturaId: args.facturaId,
    organizationId: pago.organization_id,
    usuarioId: usuario.id,
    usuarioEmail: usuario.email,
    json,
  });
}
