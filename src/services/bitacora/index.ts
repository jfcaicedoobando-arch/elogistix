/**
 * Servicio de bitácora de actividad: lectura paginada e inserción.
 * Encapsula la tabla `bitacora_actividad` para que los hooks no manejen SQL.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface EntradaBitacora {
  id: string;
  usuario_id: string;
  usuario_email: string;
  accion: string;
  modulo: string;
  entidad_id: string | null;
  entidad_nombre: string;
  detalles: Record<string, unknown>;
  created_at: string;
}

export interface FiltrosBitacora {
  modulo?: string;
  usuarioId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  limite?: number;
  pagina?: number;
  excluirLogin?: boolean;
  /** Filtra por una o varias acciones (OR). */
  acciones?: string[];
}

const BITACORA_COLUMNS =
  "id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, created_at" as const;

export async function fetchBitacora(filtros: FiltrosBitacora = {}): Promise<{
  datos: EntradaBitacora[];
  total: number;
}> {
  const {
    limite = 50,
    pagina = 0,
    modulo,
    usuarioId,
    fechaDesde,
    fechaHasta,
    excluirLogin = true,
  } = filtros;

  let query = supabase
    .from("bitacora_actividad")
    .select(BITACORA_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(pagina * limite, (pagina + 1) * limite - 1);

  const { acciones } = filtros;
  if (excluirLogin) query = query.neq("accion", "login");
  if (modulo) query = query.eq("modulo", modulo);
  if (usuarioId) query = query.eq("usuario_id", usuarioId);
  if (fechaDesde) query = query.gte("created_at", fechaDesde);
  if (fechaHasta) query = query.lte("created_at", fechaHasta);
  if (acciones && acciones.length > 0) query = query.in("accion", acciones);

  const { data, error, count } = await query;
  if (error) throw error;
  return { datos: (data ?? []) as EntradaBitacora[], total: count ?? 0 };
}

export async function fetchActividadReciente(limite = 10): Promise<EntradaBitacora[]> {
  const { data, error } = await supabase
    .from("bitacora_actividad")
    .select(BITACORA_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as EntradaBitacora[];
}

export async function insertBitacora(entrada: {
  usuarioId: string;
  usuarioEmail: string;
  accion: string;
  modulo: string;
  entidadId?: string | null;
  entidadNombre?: string;
  detalles?: Record<string, Json>;
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
