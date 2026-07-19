import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { unwrap, unwrapOr } from "@/lib/supabase/response";
import {
  PORTAL_EMBARQUE_LIST_COLUMNS,
  PORTAL_EMBARQUE_DETAIL_COLUMNS,
  PORTAL_EVENTO_COLUMNS,
  PORTAL_DOCUMENTO_COLUMNS,
  PORTAL_COTIZACION_LIST_COLUMNS,
  PORTAL_COTIZACION_DETAIL_COLUMNS,
  PORTAL_FACTURA_LIST_COLUMNS,
  PORTAL_FACTURA_DETAIL_COLUMNS,
  PORTAL_PAGO_FACTURA_COLUMNS,
} from "./columns";
import { FACTURA_ESTADOS_VIVOS } from "@/features/facturacion/domain/estadosFactura";

// Schema reutilizable para joins anidados { nombre } | null — valida en runtime.
const nombreNullableSchema = z.object({ nombre: z.string() }).nullable();

// v13.56.3 — Límites defensivos en consultas del portal. Si un cliente acumula
// más de 500 embarques/facturas o 200 eventos/documentos/pagos por embarque,
// habrá que paginar; por ahora un techo evita queries sin tope desde el portal.
const PORTAL_LIST_MAX = 500;
const PORTAL_RELATED_MAX = 200;

export async function fetchPortalEmbarques(clienteIds: string[]) {
  if (!clienteIds.length) return [];
  return unwrapOr(
    supabase
      .from("embarques")
      .select(PORTAL_EMBARQUE_LIST_COLUMNS)
      .in("cliente_id", clienteIds)
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
      .single(),
  );
}

export async function fetchPortalEventos(embarqueId: string) {
  return unwrapOr(
    supabase
      .from("eventos_embarque")
      .select(PORTAL_EVENTO_COLUMNS)
      .eq("embarque_id", embarqueId)
      // v13.301.90 (Fase Q.1): ocultar eventos borrados al cliente.
      .is("deleted_at", null)
      .order("fecha", { ascending: false })
      .limit(PORTAL_RELATED_MAX),
    [],
  );
}

export async function fetchPortalDocumentos(embarqueId: string) {
  return unwrapOr(
    supabase
      .from("documentos_embarque")
      .select(PORTAL_DOCUMENTO_COLUMNS)
      .eq("embarque_id", embarqueId)
      // v13.301.90 (Fase Q.1): ocultar documentos borrados al cliente.
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(PORTAL_RELATED_MAX),
    [],
  );
}

// Estados visibles para clientes en el portal. Borrador, Vencida y Cancelada se
// ocultan: trabajo interno o ruido sin valor. Alinear con RLS "Cliente read own cotizaciones".
const PORTAL_COTIZACION_ESTADOS_VISIBLES = ["Enviada", "Aceptada", "Rechazada", "En operación"] as const;

export async function fetchPortalCotizaciones(clienteIds: string[]) {
  if (!clienteIds.length) return [];
  const cotizaciones = await unwrapOr(
    supabase
      .from("cotizaciones")
      .select(PORTAL_COTIZACION_LIST_COLUMNS)
      .in("cliente_id", clienteIds)
      .in("estado", PORTAL_COTIZACION_ESTADOS_VISIBLES)
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

export async function fetchPortalFacturas(clienteIds: string[]) {
  if (!clienteIds.length) return [];
  return unwrapOr(
    supabase
      .from("facturas")
      .select(PORTAL_FACTURA_LIST_COLUMNS)
      .in("cliente_id", clienteIds)
      // Portal: sólo CFDI vigentes; detalle sí accesible por URL directa.
      .in("estado", [...FACTURA_ESTADOS_VIVOS])
      .order("fecha_emision", { ascending: false })
      .limit(PORTAL_LIST_MAX),
    [],
  );
}

export async function fetchPortalFactura(id: string) {
  return unwrap(
    supabase
      .from("facturas")
      .select(PORTAL_FACTURA_DETAIL_COLUMNS)
      .eq("id", id)
      .maybeSingle(),
  );
}

export async function fetchPortalPagosFactura(facturaId: string) {
  return unwrapOr(
    supabase
      .from("pagos_factura")
      .select(PORTAL_PAGO_FACTURA_COLUMNS)
      .eq("factura_id", facturaId)
      .order("fecha_pago", { ascending: false })
      .limit(PORTAL_RELATED_MAX),
    [],
  );
}

export async function fetchPortalClientUsers() {
  return unwrapOr(supabase.from("client_users").select("*").limit(PORTAL_LIST_MAX), []);
}

export async function fetchPortalClienteName(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const data = await unwrap(
    supabase
      .from("client_users")
      .select("cliente_id, clientes(nombre)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  );
  nombreNullableSchema.parse(data?.clientes ?? null); // valida shape en runtime
  const clientes = fromDb<{ nombre: string } | null>(data?.clientes);
  return clientes?.nombre ?? null;
}

export async function fetchPortalOrgName(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const data = await unwrap(
    supabase
      .from("client_users")
      .select("organizations(nombre)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  );
  nombreNullableSchema.parse(data?.organizations ?? null); // valida shape en runtime
  const org = fromDb<{ nombre: string } | null>(data?.organizations);
  return org?.nombre ?? null;
}
