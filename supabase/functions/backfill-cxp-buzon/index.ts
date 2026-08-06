/**
 * backfill-cxp-buzon — Repara facturas de proveedor capturadas desde el buzón
 * que quedaron sin XML/PDF o sin conceptos del CFDI.
 *
 * Auth: JWT válido + rol global admin/super_admin.
 * Idempotente: sólo llena lo que está vacío.
 */
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { wrapEdgeHandler, captureEdgeException } from "../_shared/sentry.ts";
import { ejecutarBackfill } from "./backfill.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function leerFacturaId(req: Request): Promise<string | null> {
  if (req.method !== "POST") return null;
  try {
    const body = await req.json();
    const raw = typeof body?.factura_id === "string" ? body.factura_id : null;
    return raw && UUID_RE.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

Deno.serve(
  wrapEdgeHandler("backfill-cxp-buzon", async (req: Request) => {
    const preflight = handlePreflightStrict(req);
    if (preflight) return preflight;
    const cors = buildCors(req);
    const log = createLogger(req, "backfill-cxp-buzon");

    try {
      const { userId, adminClient } = await authenticate(req, log);
      const { data: rol } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "super_admin", "admin_org", "contador"])
        .maybeSingle();
      if (!rol) {
        log.finish(403, "forbidden");
        return errorResponse("Requiere rol administrador o contable", 403, cors);
      }

      const facturaId = await leerFacturaId(req);
      const resultado = await ejecutarBackfill(adminClient, { facturaId });
      log.finish(200, "ok");
      return jsonResponse({ ok: true, ...resultado }, 200, cors);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.startsWith("401:")) {
        log.finish(401, "unauthorized");
        return errorResponse(msg.slice(4), 401, cors);
      }
      captureEdgeException(e, { funcion: "backfill-cxp-buzon" });
      log.finish(500, "error");
      return errorResponse(msg, 500, cors);
    }
  }),
);
