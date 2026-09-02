import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr } from "@/lib/supabase/response";
import {
  PORTAL_EMBARQUE_LIST_COLUMNS,
  PORTAL_EMBARQUE_DETAIL_COLUMNS,
  PORTAL_EVENTO_COLUMNS,
  PORTAL_DOCUMENTO_COLUMNS,
  PORTAL_COTIZACION_LIST_COLUMNS,
  PORTAL_COTIZACION_DETAIL_COLUMNS,
} from "./columns";
import { PORTAL_LIST_MAX, PORTAL_RELATED_MAX } from "./limits";

export {
  fetchPortalClientUsers,
  fetchPortalClienteName,
  fetchPortalContactoNombre,
  fetchPortalOrgName,
} from "./identity";
export {
  fetchPortalFacturas,
  fetchPortalFactura,
  fetchPortalPagosFactura,
  fetchPortalNotasCreditoFactura,
} from "./queriesFacturas";



export async function fetchPortalEmbarques(clienteIds: string[]) {
  if (!clienteIds.length) return [];
  return unwrapOr(
    supabase
      .from("embarques")
      .select(PORTAL_EMBARQUE_LIST_COLUMNS)
      .in("cliente_id", clienteIds)
      // N-03 (QA r2): ocultar embarques en papelera al cliente.
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(PORTAL_LIST_MAX),
    [],
  );
}

export async function fetchPortalEmbarque(id: string) {
  return unwrap(
    supabase
      .from("embarques")
      .select(PORTAL_EMBARQUE_DETAIL_COLUMNS)
      .eq("id", id)
      .is("deleted_at", null)
      .single(),
  );
}

// Defecto 5: `unwrap` (no `unwrapOr`) para que un error de red/RLS llegue a la
// UI como error y no como "este embarque no tiene eventos".
export async function fetchPortalEventos(embarqueId: string) {
  const rows = await unwrap(
    supabase
      .from("eventos_embarque")
      .select(PORTAL_EVENTO_COLUMNS)
      .eq("embarque_id", embarqueId)
      // v13.301.90 (Fase Q.1): ocultar eventos borrados al cliente.
      .is("deleted_at", null)
      .order("fecha", { ascending: false })
      .limit(PORTAL_RELATED_MAX),
  );
  return rows ?? [];
}

export async function fetchPortalDocumentos(embarqueId: string) {
  const rows = await unwrap(
    supabase
      .from("documentos_embarque")
      .select(PORTAL_DOCUMENTO_COLUMNS)
      .eq("embarque_id", embarqueId)
      // v13.301.90 (Fase Q.1): ocultar documentos borrados al cliente.
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(PORTAL_RELATED_MAX),
  );
  return rows ?? [];
}

// Estados visibles para clientes en el portal. Borrador, Vencida y Cancelada se
// ocultan: trabajo interno o ruido sin valor. Alinear con RLS "Cliente read own cotizaciones".
// v13.339.0 (Q-01): incluye "Solicitada" para que el cliente vea su propia solicitud.
export const PORTAL_COTIZACION_ESTADOS_VISIBLES = [
  "Solicitada",
  "Enviada",
  "Aceptada",
  "Rechazada",
  "En operación",
] as const;

export async function fetchPortalCotizaciones(clienteIds: string[]) {
  if (!clienteIds.length) return [];
  const cotizaciones = await unwrapOr(
    supabase
      .from("cotizaciones")
      .select(PORTAL_COTIZACION_LIST_COLUMNS)
      .in("cliente_id", clienteIds)
      .in("estado", PORTAL_COTIZACION_ESTADOS_VISIBLES)
      // v13.756.0: el portal nunca debe mostrar cotizaciones eliminadas.
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(PORTAL_LIST_MAX),
    [],
  );

  // Resolver expediente del embarque vinculado (cuando exista) en una segunda query batch.
  const embarqueIds = cotizaciones
    .map((c) => c.embarque_id)
    .filter((id): id is string => Boolean(id));
  if (embarqueIds.length === 0) {
    return cotizaciones.map((c) => ({ ...c, embarque_expediente: null as string | null }));
  }
  const embs = await unwrapOr(
    supabase.from("embarques").select("id, expediente").in("id", embarqueIds),
    [],
  );
  const expById = new Map(embs.map((e) => [e.id, e.expediente]));
  return cotizaciones.map((c) => ({
    ...c,
    embarque_expediente: c.embarque_id ? expById.get(c.embarque_id) ?? null : null,
  }));
}

export async function fetchPortalCotizacion(id: string) {
  // Sin join embebido: RLS distinta en embarques puede colapsar .single() a PGRST116.
  // v13.301.90 (Fase Q.1): whitelist explícita en lugar de `select("*")` para
  // no exponer 30+ campos internos (tarifa, revalidación, prospecto, IDs de staff).
  const data = await unwrap(
    supabase
      .from("cotizaciones")
      .select(PORTAL_COTIZACION_DETAIL_COLUMNS)
      .eq("id", id)
      // v13.756.0: una cotización eliminada se trata como inexistente.
      .is("deleted_at", null)
      .maybeSingle(),
  );
  if (!data) return null;

  // Expediente del embarque vinculado (opcional, tolera fallo de RLS).
  let embarque_expediente: string | null = null;
  if (data.embarque_id) {
    const { data: emb } = await supabase
      .from("embarques")
      .select("expediente")
      .eq("id", data.embarque_id)
      .maybeSingle();
    embarque_expediente = emb?.expediente ?? null;
  }
  return { ...data, embarque_expediente };
}
