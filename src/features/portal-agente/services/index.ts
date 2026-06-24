/**
 * Servicios del Portal del Agente de Carga.
 * Todas las queries pasan por RLS (`current_agente_id`/`current_agente_org`).
 * El agente sólo ve filas que le pertenecen.
 */
import { supabase } from "@/integrations/supabase/client";
import { AUTH_ERROR_MESSAGES } from "@/constants/authMessages";

export interface AgenteContext {
  agenteId: string;
  organizationId: string;
  organizacionNombre: string;
  proveedorId: string | null;
  agenteNombre: string;
  email: string;
}

/** Contexto completo del agente autenticado vía RPC SECURITY DEFINER
 *  (salta RLS de `costeo_agentes` y `organizations`, a las que el agente
 *  no tiene SELECT directo). */
export async function fetchAgenteContext(): Promise<AgenteContext> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error(AUTH_ERROR_MESSAGES.notAuthenticated);

  const { data, error } = await supabase.rpc("get_current_agente_context");
  if (error) throw error;

  // SAFE-CAST: la RPC devuelve SETOF con una sola fila o vacío.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Tu usuario aún no está vinculado a un agente. Contacta a operaciones.");

  const r = row as {
    agente_id: string;
    organization_id: string;
    proveedor_id: string | null;
    agente_nombre: string | null;
    organizacion_nombre: string | null;
  };

  return {
    agenteId: r.agente_id,
    organizationId: r.organization_id,
    organizacionNombre: r.organizacion_nombre ?? "Organización",
    proveedorId: r.proveedor_id ?? null,
    agenteNombre: r.agente_nombre ?? "Agente",
    email: user.email ?? "",
  };
}

export interface AgenteTarifaRow {
  id: string;
  ruta_id: string;
  naviera_id: string;
  tipo_contenedor_id: string;
  moneda: string;
  flete_base: number;
  vigente_desde: string;
  vigente_hasta: string;
  estado: string;
  estado_aprobacion: string;
  motivo_rechazo: string | null;
  aprobada_en: string | null;
  agente_nombre: string;
  naviera_nombre: string;
  tipo_contenedor_nombre: string;
  puerto_origen_nombre: string;
  puerto_destino_nombre: string;
}

/** Lista todas las tarifas del agente autenticado (cualquier estado_aprobacion). */
export async function fetchAgenteTarifas(): Promise<AgenteTarifaRow[]> {
  const { data, error } = await supabase
    .from("costeo_tarifas")
    .select(`
      id, ruta_id, naviera_id, tipo_contenedor_id, moneda, flete_base,
      vigente_desde, vigente_hasta, estado, estado_aprobacion,
      motivo_rechazo, aprobada_en,
      costeo_agentes:agente_id(nombre),
      navieras:naviera_id(name),
      tipos_contenedor:tipo_contenedor_id(name),
      costeo_rutas:ruta_id(
        puerto_origen:puertos!costeo_rutas_puerto_origen_id_fkey(name),
        puerto_destino:puertos!costeo_rutas_puerto_destino_id_fkey(name)
      )
    `)
    .order("vigente_desde", { ascending: false })
    .limit(500);
  if (error) throw error;
  // SAFE-CAST: alias de relaciones — el cliente generado infiere never en joins anidados.
  type Raw = {
    id: string; ruta_id: string; naviera_id: string; tipo_contenedor_id: string;
    moneda: string; flete_base: number;
    vigente_desde: string; vigente_hasta: string; estado: string; estado_aprobacion: string;
    motivo_rechazo: string | null; aprobada_en: string | null;
    costeo_agentes?: { nombre?: string } | null;
    navieras?: { name?: string } | null;
    tipos_contenedor?: { name?: string } | null;
    costeo_rutas?: {
      puerto_origen?: { name?: string } | null;
      puerto_destino?: { name?: string } | null;
    } | null;
  };
  // SAFE-CAST: `data` viene del cliente Supabase con tipos generados (joins
  // anidados resueltos al shape `Raw` declarado arriba). El cast aplana
  // únicamente la unión `null | Raw[]` a `Raw[]` para iterar.
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    ruta_id: r.ruta_id,
    naviera_id: r.naviera_id,
    tipo_contenedor_id: r.tipo_contenedor_id,
    moneda: r.moneda,
    flete_base: Number(r.flete_base) || 0,
    vigente_desde: r.vigente_desde,
    vigente_hasta: r.vigente_hasta,
    estado: r.estado,
    estado_aprobacion: r.estado_aprobacion,
    motivo_rechazo: r.motivo_rechazo,
    aprobada_en: r.aprobada_en,
    agente_nombre: r.costeo_agentes?.nombre ?? "—",
    naviera_nombre: r.navieras?.name ?? "—",
    tipo_contenedor_nombre: r.tipos_contenedor?.name ?? "—",
    puerto_origen_nombre: r.costeo_rutas?.puerto_origen?.name ?? "—",
    puerto_destino_nombre: r.costeo_rutas?.puerto_destino?.name ?? "—",
  }));
}

export interface AgenteEmbarqueRow {
  id: string;
  expediente: string;
  modo: string;
  estado: string;
  bl_master: string | null;
  puerto_origen: string | null;
  puerto_destino: string | null;
  etd: string | null;
  eta: string | null;
}

export async function fetchAgenteEmbarques(): Promise<AgenteEmbarqueRow[]> {
  const { data, error } = await supabase
    .from("embarques")
    .select("id, expediente, modo, estado, bl_master, puerto_origen, puerto_destino, etd, eta")
    .order("etd", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as AgenteEmbarqueRow[];
}
