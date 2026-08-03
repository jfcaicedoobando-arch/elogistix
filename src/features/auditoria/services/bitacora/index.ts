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

  let query = supabase
    .from("bitacora_actividad")
    .select(BITACORA_COLUMNS, { count: "exact" })
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
