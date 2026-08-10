/**
 * Precarga y validación de contexto para cancelar una nota de crédito.
 * Extraído de index.ts (Ola 4) para bajar la complejidad ciclomática del
 * handler principal por debajo del límite de ESLint.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { authorizeOrgRole, ROLES_EMISOR_FISCAL } from "../_shared/auth.ts";
import { jsonResponse } from "../_shared/response.ts";

export interface ReqBody {
  nota_credito_id?: string;
  motivo?: string;
  sustituye_uuid?: string;
}

export interface NcRow {
  id: string;
  organization_id: string;
  facturapi_id: string | null;
  estado: string | null;
}

export type CtxResult =
  | { ok: false; response: Response }
  | { ok: true; nc: NcRow; sustituyeFacturapiId?: string };

const MOTIVOS_VALIDOS = new Set(["01", "02", "03", "04"]);

export function validateRequest(req: Request, body: ReqBody): Response | null {
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!body.nota_credito_id) return jsonResponse({ error: "nota_credito_id_required" }, 400);
  if (!body.motivo || !MOTIVOS_VALIDOS.has(body.motivo)) {
    return jsonResponse({ error: "motivo_invalido", message: "Motivo SAT requerido (01-04)." }, 400);
  }
  if (body.motivo === "01" && !body.sustituye_uuid) {
    return jsonResponse({ error: "sustituye_uuid_required", message: "El motivo 01 requiere UUID de sustitución." }, 400);
  }
  return null;
}

async function cargarNc(supabase: SupabaseClient, id: string): Promise<CtxResult> {
  const { data, error } = await supabase
    .from("factura_notas_credito")
    .select("id, organization_id, facturapi_id, estado")
    .eq("id", id)
    .maybeSingle();
  const nc = data as NcRow | null;
  if (error || !nc) return { ok: false, response: jsonResponse({ error: "nota_credito_not_found" }, 404) };
  if (!nc.facturapi_id) return { ok: false, response: jsonResponse({ error: "no_timbrada" }, 409) };
  if (nc.estado === "Cancelada") {
    return {
      ok: false,
      response: jsonResponse({ error: "ya_cancelada", message: "Esta nota de crédito ya está cancelada." }, 409),
    };
  }
  return { ok: true, nc };
}

/**
 * Ola 4 · N4: FacturAPI espera el facturapi_id (ObjectId) de la NC sustituta
 * en `substitution`, NO el UUID SAT. La UI captura el UUID; aquí se resuelve
 * contra las NC timbradas de ESTA organización.
 */
async function resolverSustituta(
  supabase: SupabaseClient,
  organizationId: string,
  uuidFiscal: string,
): Promise<{ ok: true; facturapiId: string } | { ok: false; response: Response }> {
  const { data } = await supabase
    .from("factura_notas_credito")
    .select("id, facturapi_id")
    .eq("organization_id", organizationId)
    .eq("uuid_fiscal", uuidFiscal)
    .maybeSingle();
  const facturapiId = (data as { facturapi_id?: string | null } | null)?.facturapi_id;
  if (!facturapiId) {
    return {
      ok: false,
      response: jsonResponse({
        error: "sustituta_no_encontrada",
        message: "No hay una nota de crédito timbrada con ese UUID en esta organización. Timbra primero la NC sustituta.",
      }, 422),
    };
  }
  return { ok: true, facturapiId };
}

export async function preloadCancelContext(
  supabase: SupabaseClient,
  body: ReqBody,
  usuarioId: string,
): Promise<CtxResult> {
  const cargada = await cargarNc(supabase, body.nota_credito_id!);
  if (!cargada.ok) return cargada;
  const { nc } = cargada;

  const autorizado = await authorizeOrgRole(supabase, usuarioId, nc.organization_id, ROLES_EMISOR_FISCAL);
  if (!autorizado) return { ok: false, response: jsonResponse({ error: "forbidden" }, 403) };

  if (body.motivo !== "01") return { ok: true, nc };

  const sustituta = await resolverSustituta(supabase, nc.organization_id, body.sustituye_uuid!);
  if (!sustituta.ok) return { ok: false, response: sustituta.response };
  return { ok: true, nc, sustituyeFacturapiId: sustituta.facturapiId };
}
