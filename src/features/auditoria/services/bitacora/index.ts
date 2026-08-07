/**
 * Servicio de bitácora de actividad: lectura paginada e inserción.
 * Encapsula la tabla `bitacora_actividad` para que los hooks no manejen SQL.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type { EntradaBitacora, FiltrosBitacora } from "@/types/bitacora";
import type { EntradaBitacora, FiltrosBitacora } from "@/types/bitacora";

const BITACORA_COLUMNS =
  "id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, created_at" as const;

/** Aplica los filtros opcionales de la bitácora (extraído por complejidad). */
function aplicarFiltrosBitacora<Q extends {
  neq: (c: string, v: string) => Q;
  eq: (c: string, v: string) => Q;
  gte: (c: string, v: string) => Q;
  lte: (c: string, v: string) => Q;
  in: (c: string, v: string[]) => Q;
}>(query: Q, f: FiltrosBitacora & { excluirLogin: boolean }): Q {
  let q = query;
  if (f.excluirLogin) q = q.neq("accion", "login");
  if (f.modulo) q = q.eq("modulo", f.modulo);
  if (f.usuarioId) q = q.eq("usuario_id", f.usuarioId);
  if (f.entidadId) q = q.eq("entidad_id", f.entidadId);
  if (f.fechaDesde) q = q.gte("created_at", f.fechaDesde);
  if (f.fechaHasta) q = q.lte("created_at", f.fechaHasta);
  if (f.acciones && f.acciones.length > 0) q = q.in("accion", f.acciones);
  // R6-FIX3: la RLS ya permite leer la org completa; el filtro explícito evita
  // mezclar organizaciones cuando el usuario pertenece a varias.
  if (f.organizationId) q = q.eq("organization_id", f.organizationId);
  return q;
}

export async function fetchBitacora(filtros: FiltrosBitacora = {}): Promise<{
  datos: EntradaBitacora[];
  total: number;
}> {
  const {
    limite = 50,
    pagina = 0,
    modulo,
    usuarioId,
    entidadId,
    fechaDesde,
    fechaHasta,
    excluirLogin = true,
    organizationId,
  } = filtros;

  // Perf (asesor BD 2026-08-07): `count: "exact"` obligaba a contar TODA la
  // tabla en cada página (máx 3.8 s). `"estimated"` devuelve el conteo exacto
  // mientras la tabla es chica y cae al estimado del planner cuando crece.
  let query = supabase
    .from("bitacora_actividad")
    .select(BITACORA_COLUMNS, { count: "estimated" })
    .order("created_at", { ascending: false })
    .range(pagina * limite, (pagina + 1) * limite - 1);

  const { acciones } = filtros;
  query = aplicarFiltrosBitacora(query, {
    excluirLogin, modulo, usuarioId, entidadId, fechaDesde, fechaHasta, acciones, organizationId,
  });

  const { data, error, count } = await query;
  if (error) throw error;
  return { datos: (data ?? []) as EntradaBitacora[], total: count ?? 0 };
}

export async function insertBitacora(entrada: {
  usuarioId: string;
  usuarioEmail: string;
  accion: string;
  modulo: string;
  entidadId?: string | null;
  entidadNombre?: string;
  detalles?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("bitacora_actividad").insert([
    {
      usuario_id: entrada.usuarioId,
      usuario_email: entrada.usuarioEmail,
      accion: entrada.accion,
      modulo: entrada.modulo,
      entidad_id: entrada.entidadId ?? null,
      entidad_nombre: entrada.entidadNombre ?? "",
      detalles: (entrada.detalles ?? {}) as Json,
    },
  ]);
  if (error) throw error;
}
