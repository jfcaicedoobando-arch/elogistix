/**
 * facturapi-reconciliar-cancelaciones — cron que consulta a FacturApi el
 * `cancellation_status` de cada factura marcada como `pending` o `verifying`
 * y sincroniza la BD (aceptada → estado Cancelada/Sustituida + acuse; rechazada
 * o expirada → limpiar solicitud; sin cambios → no-op).
 *
 * Se dispara cada 30 minutos via pg_cron/pg_net. Es seguro reintentar: idempotente.
 * NO recibe input del usuario (llamado por el scheduler); usa service_role.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { getFacturapiClient } from "../_shared/facturapiClient.ts";
import { FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface FacturaPendiente {
  id: string;
  organization_id: string;
  facturapi_id: string;
  cancellation_status: string;
  sustituida_por: string | null;
}

interface FapiInvoiceStatus {
  status?: string;
  cancellation_status?: string;
}

Deno.serve(wrapEdgeHandler("facturapi-reconciliar-cancelaciones", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: pendientes, error: fetchErr } = await supabase
    .from("facturas")
    .select("id, organization_id, facturapi_id, cancellation_status, sustituida_por")
    .in("cancellation_status", ["pending", "verifying"])
    .not("facturapi_id", "is", null)
    .limit(200);

  if (fetchErr) return jsonResponse({ error: "db_fetch_failed", detail: fetchErr.message }, 500);

  const facturas = (pendientes ?? []) as FacturaPendiente[];
  const resumen = { revisadas: 0, aceptadas: 0, rechazadas: 0, expiradas: 0, sin_cambio: 0, errores: 0 };

  // Agrupar por organization_id para reutilizar el cliente FacturApi.
  const porOrg = new Map<string, FacturaPendiente[]>();
  for (const f of facturas) {
    if (!porOrg.has(f.organization_id)) porOrg.set(f.organization_id, []);
    porOrg.get(f.organization_id)!.push(f);
  }

  for (const [orgId, lote] of porOrg) {
    const resolved = await getFacturapiClient(supabase, orgId);
    if (!resolved.ok) {
      resumen.errores += lote.length;
      continue;
    }
    const facturapi = resolved.data.client;
    const apiKey = resolved.data.apiKey;

    for (const factura of lote) {
      resumen.revisadas++;
      try {
        const remote = await facturapi.invoices.retrieve(factura.facturapi_id) as FapiInvoiceStatus;
        const cs = (remote.cancellation_status ?? "").toLowerCase();
        const nowIso = new Date().toISOString();

        if (cs === factura.cancellation_status) {
          resumen.sin_cambio++;
          continue;
        }

        if (cs === "accepted" || remote.status === "canceled") {
          const esSustitucion = !!factura.sustituida_por;
          const acuse = await descargarAcuseCancelacion(factura.facturapi_id, apiKey);
          const patch: Record<string, unknown> = {
            estado: esSustitucion ? "Sustituida" : "Cancelada",
            cancellation_status: "accepted",
            cancelado_en: nowIso,
            acuse_cancelacion_xml: acuse.xml,
            acuse_cancelacion_fecha: acuse.xml ? nowIso : null,
            acuse_cancelacion_status: acuse.status,
          };
          const { error: upErr } = await supabase.from("facturas").update(patch).eq("id", factura.id);
          if (upErr) { resumen.errores++; continue; }

          // Revertir proformas SÓLO si no fue sustitución.
          if (!esSustitucion) {
            const { data: pfs } = await supabase
              .from("proformas")
              .select("id, factura_id, factura_secundaria_id")
              .or(`factura_id.eq.${factura.id},factura_secundaria_id.eq.${factura.id}`);
            for (const pf of pfs ?? []) {
              const nuevoFacturaId = pf.factura_id === factura.id ? null : pf.factura_id;
              const nuevoFacturaSecId = pf.factura_secundaria_id === factura.id ? null : pf.factura_secundaria_id;
              const ambosNulos = !nuevoFacturaId && !nuevoFacturaSecId;
              const pfPatch: Record<string, unknown> = {
                factura_id: nuevoFacturaId,
                factura_secundaria_id: nuevoFacturaSecId,
              };
              if (ambosNulos) {
                pfPatch.estado_proforma = "pendiente";
                pfPatch.fecha_facturacion = null;
                pfPatch.folio_factura_externa = null;
              }
              await supabase.from("proformas").update(pfPatch).eq("id", pf.id);
            }
          }

          await registrarBitacoraEdge(supabase, {
            organizationId: orgId,
            usuarioId: null,
            modulo: "facturacion",
            accion: esSustitucion ? "facturapi_sustituida_async" : "facturapi_cancelada_async",
            entidadId: factura.id,
            detalles: { via: "cron_reconciliacion", cancellation_status: "accepted" },
          });
          resumen.aceptadas++;
        } else if (cs === "rejected" || cs === "expired") {
          await supabase.from("facturas").update({
            cancellation_status: cs,
            cancelacion_solicitada_en: null,
            cancelacion_vence_en: null,
          }).eq("id", factura.id);
          await registrarBitacoraEdge(supabase, {
            organizationId: orgId,
            usuarioId: null,
            modulo: "facturacion",
            accion: "facturapi_cancelacion_no_aceptada",
            entidadId: factura.id,
            detalles: { via: "cron_reconciliacion", cancellation_status: cs },
          });
          if (cs === "rejected") resumen.rechazadas++;
          else resumen.expiradas++;
        } else if (cs && cs !== factura.cancellation_status) {
          // Transición pending → verifying (o viceversa): sólo actualizar el estado.
          await supabase.from("facturas").update({ cancellation_status: cs }).eq("id", factura.id);
          resumen.sin_cambio++;
        } else {
          resumen.sin_cambio++;
        }
      } catch (_err) {
        resumen.errores++;
      }
    }
  }

  return jsonResponse({ ok: true, resumen });
}));
