/**
 * Servicios del Portal del Agente de Carga.
 * Todas las queries pasan por RLS (`current_agente_id`/`current_agente_org`).
 * El agente sólo ve filas que le pertenecen.
 */
import { supabase } from "@/integrations/supabase/client";
import { AUTH_ERROR_MESSAGES } from "@/constants/authMessages";
import { unwrap, unwrapOr } from "@/lib/supabase/response";

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
export async function fetchAgenteContext(userEmail?: string | null): Promise<AgenteContext> {
  // B-078: `getUser()` hace roundtrip a /auth/v1/user y puede resolver sin
  // usuario durante la rehidratación de sesión (o con proxies que reescriben
  // /auth/v1/*) → la query moría con "No autenticado" y los botones de
  // tarifa quedaban muertos. `getSession()` lee la sesión local sin red;
  // el email del AuthContext (patrón B-059) es el último respaldo.
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user?.email ?? userEmail ?? null;
  if (!session && !userEmail) throw new Error(AUTH_ERROR_MESSAGES.notAuthenticated);

  const data = await unwrap(supabase.rpc("get_current_agente_context"));

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
    email: email ?? "",
  };
}

export interface AgenteRutaRow {
  id: string;
  organization_id: string;
  activa: boolean;
  puerto_origen_nombre?: string;
  puerto_destino_nombre?: string;
}

/** Lista las rutas activas de la organización del agente vía RPC SECURITY DEFINER
 *  (el agente no tiene SELECT directo sobre `costeo_rutas` por RLS). */
export async function fetchAgenteRutas(): Promise<AgenteRutaRow[]> {
  const data = await unwrapOr(supabase.rpc("get_agente_rutas"), []);
  // SAFE-CAST: la RPC devuelve SETOF con el shape declarado por la función.
  const rows = data as Array<{
    id: string;
    organization_id: string;
    activa: boolean;
    puerto_origen_nombre: string | null;
    puerto_destino_nombre: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    organization_id: r.organization_id,
    activa: r.activa,
    puerto_origen_nombre: r.puerto_origen_nombre ?? undefined,
    puerto_destino_nombre: r.puerto_destino_nombre ?? undefined,
  }));
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
  transit_time_dias: number | null;
  dias_libres_demoras: number;
  notas: string | null;
  agente_nombre: string;
  naviera_nombre: string;
  tipo_contenedor_nombre: string;
  puerto_origen_nombre: string;
  puerto_destino_nombre: string;
}

/** Forma cruda del join anidado de `costeo_tarifas` (alias de relaciones). */
type RawTarifaAgente = {
  id: string; ruta_id: string; naviera_id: string; tipo_contenedor_id: string;
  moneda: string; flete_base: number;
  vigente_desde: string; vigente_hasta: string; estado: string; estado_aprobacion: string;
  motivo_rechazo: string | null; aprobada_en: string | null;
  transit_time_dias: number | null; dias_libres_demoras: number | null;
  notas: string | null;
  costeo_agentes?: { nombre?: string } | null;
  navieras?: { name?: string } | null;
  tipos_contenedor?: { name?: string } | null;
  costeo_rutas?: {
    puerto_origen?: { name?: string } | null;
    puerto_destino?: { name?: string } | null;
  } | null;
};

/** Nombres legibles de las relaciones de una tarifa (guion largo si faltan). */
function nombresRelacionesTarifa(r: RawTarifaAgente) {
  const txt = (v?: string | null) => v ?? "—";
  return {
    agente_nombre: txt(r.costeo_agentes?.nombre),
    naviera_nombre: txt(r.navieras?.name),
    tipo_contenedor_nombre: txt(r.tipos_contenedor?.name),
    puerto_origen_nombre: txt(r.costeo_rutas?.puerto_origen?.name),
    puerto_destino_nombre: txt(r.costeo_rutas?.puerto_destino?.name),
  };
}

/** Lista todas las tarifas del agente autenticado (cualquier estado_aprobacion). */
export async function fetchAgenteTarifas(): Promise<AgenteTarifaRow[]> {
  const data = await unwrapOr(
    supabase
      .from("costeo_tarifas")
      .select(`
      id, ruta_id, naviera_id, tipo_contenedor_id, moneda, flete_base,
      vigente_desde, vigente_hasta, estado, estado_aprobacion,
      motivo_rechazo, aprobada_en,
      transit_time_dias, dias_libres_demoras, notas,
      costeo_agentes:agente_id(nombre),
      navieras:naviera_id(name),
      tipos_contenedor:tipo_contenedor_id(name),
      costeo_rutas:ruta_id(
        puerto_origen:puertos!costeo_rutas_puerto_origen_id_fkey(name),
        puerto_destino:puertos!costeo_rutas_puerto_destino_id_fkey(name)
      )
    `)
      .order("vigente_desde", { ascending: false })
      .limit(500),
    [],
  );
  // SAFE-CAST: alias de relaciones — el cliente generado infiere never en joins anidados.
  return (data as unknown as RawTarifaAgente[]).map((r) => ({
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
    transit_time_dias: r.transit_time_dias ?? null,
    dias_libres_demoras: Number(r.dias_libres_demoras) || 0,
    notas: r.notas ?? null,
    ...nombresRelacionesTarifa(r),
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
  const data = await unwrapOr(
    supabase
      .from("embarques")
      .select("id, expediente, modo, estado, bl_master, puerto_origen, puerto_destino, etd, eta")
      .order("etd", { ascending: false, nullsFirst: false })
      .limit(200),
    [],
  );
  // SAFE-CAST: select explícito coincide 1:1 con AgenteEmbarqueRow.
  return data as unknown as AgenteEmbarqueRow[];
}
