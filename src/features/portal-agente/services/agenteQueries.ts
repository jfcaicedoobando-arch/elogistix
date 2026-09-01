/**
 * Queries del Portal del Agente de Carga.
 * Todas pasan por RLS (`current_agente_id`/`current_agente_org`): el agente
 * sólo ve filas que le pertenecen.
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

const AGENTE_EMBARQUES_SELECT =
  "id, expediente, modo, estado, bl_master, puerto_origen, puerto_destino, etd, eta";

/**
 * Tamaño de lote de lectura. NO es un cap: se piden lotes consecutivos hasta
 * recibir uno incompleto, así que el historial siempre llega completo.
 */
const AGENTE_BATCH_SIZE = 1000;

/**
 * Historial de embarques visibles para el agente (filtrado por RLS).
 *
 * Antes terminaba en `.limit(200)`: los embarques 201+ desaparecían sin aviso
 * y el agente creía que su historial acababa ahí. Ahora se leen lotes
 * consecutivos con orden determinista (`etd` desc, nulls last, desempate por
 * `id`) para no omitir ni duplicar filas cuando varias comparten ETD. El error
 * de cualquier lote se propaga: nunca se devuelve un resultado parcial como
 * si fuera completo.
 */
export async function fetchAgenteEmbarques(): Promise<AgenteEmbarqueRow[]> {
  const acumulado: AgenteEmbarqueRow[] = [];
  for (let offset = 0; ; offset += AGENTE_BATCH_SIZE) {
    const { data, error } = await supabase
      .from("embarques")
      .select(AGENTE_EMBARQUES_SELECT)
      .is("deleted_at", null)
      .order("etd", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + AGENTE_BATCH_SIZE - 1);
    if (error) throw error;
    // SAFE-CAST: select explícito coincide 1:1 con AgenteEmbarqueRow.
    const lote = (data as unknown as AgenteEmbarqueRow[] | null) ?? [];
    acumulado.push(...lote);
    if (lote.length < AGENTE_BATCH_SIZE) return acumulado;
  }
}
