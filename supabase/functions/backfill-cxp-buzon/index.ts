/**
 * backfill-cxp-buzon — Repara facturas de proveedor capturadas desde el buzón
 * que quedaron sin XML/PDF o sin conceptos del CFDI.
 *
 * Auth (R2 seguridad · P1): JWT válido + rol de captura CxP DENTRO de la
 * organización objetivo. Antes bastaba un rol global (`contador`, `admin_org`)
 * y el barrido corría sobre TODAS las organizaciones con la service role key,
 * copiando archivos de storage y sembrando conceptos de otros tenants.
 * `super_admin` puede apuntar a una org explícita con `organization_id`.
 *
 * Idempotente: sólo llena lo que está vacío.
 */
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate, authorizeOrgRole, ROLES_CAPTURA_CXP } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { wrapEdgeHandler, captureEdgeException } from "../_shared/sentry.ts";
import { ejecutarBackfill } from "./backfill.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOrNull(raw: unknown): string | null {
  return typeof raw === "string" && UUID_RE.test(raw) ? raw : null;
}

async function leerBody(req: Request): Promise<{ facturaId: string | null; orgId: string | null }> {
  if (req.method !== "POST") return { facturaId: null, orgId: null };
  try {
    const body = await req.json();
    return {
      facturaId: uuidOrNull(body?.factura_id),
      orgId: uuidOrNull(body?.organization_id),
    };
  } catch {
    return { facturaId: null, orgId: null };
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
      const { facturaId, orgId: orgSolicitada } = await leerBody(req);

      // Org objetivo: la solicitada (sólo la valida `authorizeOrgRole`, que ya
      // exige membresía salvo para `super_admin`) o la membresía del usuario.
      let organizationId = orgSolicitada;
      if (!organizationId) {
        const { data: membership } = await adminClient
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        organizationId = (membership as { organization_id?: string } | null)?.organization_id ?? null;
      }
      if (!organizationId) {
        log.finish(403, "sin_org", { user_id: userId });
        return errorResponse("No se pudo resolver la organización a reparar", 403, cors);
      }

      const permitido = await authorizeOrgRole(
        adminClient, userId, organizationId, ROLES_CAPTURA_CXP,
      );
      if (!permitido) {
        log.finish(403, "forbidden", { user_id: userId, organization_id: organizationId });
        return errorResponse("Requiere rol contable en esta organización", 403, cors);
      }

      const resultado = await ejecutarBackfill(adminClient, { facturaId, organizationId });
      log.finish(200, "ok", { user_id: userId, organization_id: organizationId });
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

