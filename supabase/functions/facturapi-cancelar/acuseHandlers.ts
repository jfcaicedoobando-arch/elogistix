/**
 * Handlers de "solo descargar acuse" (XML y PDF). Extraídos de `index.ts` para
 * respetar el límite Power-of-10 (<200 líneas por función).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { authorizeOrgMembership } from "../_shared/auth.ts";
import { getFacturapiClient } from "../_shared/facturapiClient.ts";
import { descargarAcuseCancelacion } from "./descargarAcuse.ts";
import { descargarAcuseCancelacionPdf } from "./descargarAcusePdf.ts";
import { fetchOrgSlug } from "../_shared/orgSlug.ts";

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export async function handleDescargarAcusePdf(
  supabase: SupabaseClient,
  userId: string,
  facturaId: string,
): Promise<Response> {
  const { data: facp, error: facpErr } = await supabase
    .from("facturas")
    .select("id, facturapi_id, organization_id, estado, numero")
    .eq("id", facturaId)
    .maybeSingle();
  if (facpErr || !facp) return json({ error: "factura_not_found" }, 404);
  if (!facp.facturapi_id) return json({ error: "no_timbrada" }, 409);
  if (!(await authorizeOrgMembership(supabase, userId, facp.organization_id))) {
    return json({ error: "forbidden" }, 403);
  }
  if (facp.estado !== "Cancelada" && facp.estado !== "Sustituida") {
    return json({ error: "no_cancelada", message: "La factura aún no está cancelada." }, 409);
  }
  const clip = await getFacturapiClient(supabase, facp.organization_id);
  if (!clip.ok) return json({ error: clip.data.error, message: clip.data.message }, clip.data.status);
  const pdfRes = await descargarAcuseCancelacionPdf(facp.facturapi_id, clip.data.apiKey);
  if (!pdfRes.ok) {
    if (pdfRes.reason === "not_ready") {
      return json({
        error: "acuse_pdf_no_disponible",
        message: "El SAT aún no ha emitido el acuse en PDF. Intenta más tarde o usa 'Reintentar acuse'.",
      }, 404);
    }
    return json({ error: "facturapi_error", status: pdfRes.status }, 502);
  }
  const orgSlug = await fetchOrgSlug(supabase, facp.organization_id);
  const filename = `${orgSlug}_acuse-cancelacion-${(facp.numero ?? facp.id).replace(/[^A-Za-z0-9._-]+/g, "_")}.pdf`;
  return new Response(pdfRes.pdf, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function handleDescargarAcuseXml(
  supabase: SupabaseClient,
  userId: string,
  facturaId: string,
): Promise<Response> {
  const { data: fac, error: facErr } = await supabase
    .from("facturas")
    .select("id, facturapi_id, organization_id, estado")
    .eq("id", facturaId)
    .maybeSingle();
  if (facErr || !fac) return json({ error: "factura_not_found" }, 404);
  if (!fac.facturapi_id) return json({ error: "no_timbrada" }, 409);
  if (fac.estado !== "Cancelada" && fac.estado !== "Sustituida") {
    return json({ error: "no_cancelada", message: "La factura aún no está cancelada." }, 409);
  }
  if (!(await authorizeOrgMembership(supabase, userId, fac.organization_id))) {
    return json({ error: "forbidden" }, 403);
  }
  const cli = await getFacturapiClient(supabase, fac.organization_id);
  if (!cli.ok) return json({ error: cli.data.error, message: cli.data.message }, cli.data.status);
  const acuseSolo = await descargarAcuseCancelacion(fac.facturapi_id, cli.data.apiKey);
  const { error: updErr2 } = await supabase
    .from("facturas")
    .update({
      acuse_cancelacion_xml: acuseSolo.xml ?? null,
      acuse_cancelacion_fecha: acuseSolo.xml ? new Date().toISOString() : null,
      acuse_cancelacion_status: acuseSolo.status,
    })
    .eq("id", fac.id);
  if (updErr2) return json({ error: "db_update_failed", detail: updErr2.message }, 500);
  return json({
    ok: true,
    acuse_status: acuseSolo.status,
    acuse_guardado: !!acuseSolo.xml,
  });
}
