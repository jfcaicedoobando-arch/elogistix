// Edge function: jsoncargo-bol-lookup
// Devuelve los contenedores asociados a un BL Master usando JSONCargo.
// Auth: JWT requerido (RLS valida acceso al embarque).

import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { fetchBolContainers, mapNaviera } from "../_shared/jsoncargo.ts";

interface RequestBody {
  embarqueId?: string;
}

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);

  if (req.method !== "POST") return errorResponse("Method not allowed", 405, cors);

  // @ts-expect-error Deno global
  const apiKey = Deno.env.get("JSONCARGO_API_KEY");
  if (!apiKey) return errorResponse("JSONCARGO_API_KEY no configurada", 500, cors);

  let auth;
  try {
    auth = await authenticate(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "auth error";
    return errorResponse(msg.replace(/^401:/, ""), 401, cors);
  }

  let body: RequestBody = {};
  try { body = await req.json(); } catch { /* */ }
  const embarqueId = body.embarqueId;
  if (!embarqueId || typeof embarqueId !== "string") {
    return errorResponse("embarqueId requerido", 400, cors);
  }

  const { data: embarque, error: embErr } = await auth.anonClient
    .from("embarques")
    .select("id, bl_master, naviera, modo, organization_id, expediente, contenedor")
    .eq("id", embarqueId)
    .maybeSingle();
  if (embErr || !embarque) return errorResponse("Embarque no encontrado o sin acceso", 404, cors);

  if (embarque.modo !== "Marítimo") {
    return errorResponse("Solo embarques marítimos", 422, cors);
  }
  if (!embarque.bl_master) {
    return errorResponse("Embarque sin BL Master", 422, cors);
  }
  const shippingLine = mapNaviera(embarque.naviera);
  if (!shippingLine) {
    return errorResponse(`Naviera "${embarque.naviera ?? "—"}" no soportada por JSONCargo`, 422, cors);
  }

  const result = await fetchBolContainers(apiKey, embarque.bl_master, shippingLine);

  // Bitácora (best-effort)
  try {
    await auth.adminClient.from("bitacora_actividad").insert({
      accion: "jsoncargo_bol_lookup",
      modulo: "tracking",
      entidad_id: embarque.id,
      entidad_nombre: embarque.expediente ?? "",
      organization_id: embarque.organization_id,
      usuario_id: auth.userId,
      detalles: {
        bl_master: embarque.bl_master,
        naviera: shippingLine,
        ok: result.ok,
        containers_found: result.data?.associated_containers ?? 0,
        error: result.ok ? null : (result.errorTitle ?? null),
      },
    });
  } catch { /* ignore */ }

  if (!result.ok || !result.data) {
    const status = result.status === 404 ? 404 : (result.status === 429 ? 429 : 200);
    return jsonResponse({
      ok: false,
      status: result.status,
      error: result.errorTitle ?? "Error JSONCargo",
    }, status, cors);
  }

  return jsonResponse({
    ok: true,
    bill_of_lading: result.data.bill_of_lading,
    shipping_line_name: result.data.shipping_line_name,
    shipping_line_id: result.data.shipping_line_id,
    associated_containers: result.data.associated_containers,
    associated_container_numbers: result.data.associated_container_numbers,
    last_updated: result.data.last_updated,
    current_contenedor: embarque.contenedor ?? null,
  }, 200, cors);
});
