/**
 * Servicio de actualización de demoras por contenedor.
 * Encapsula la mutación directa que antes vivía en `TabDemoras.tsx`.
 *
 * v13.66.11: columnas nuevas (`fecha_descarga`, `fecha_devolucion`,
 * `dias_libres_override`) aún no regeneradas en `supabase/types.ts`.
 */
import { supabase } from "@/integrations/supabase/client";

export interface DemorasContenedorPatch {
  fecha_descarga?: string | null;
  fecha_devolucion?: string | null;
  dias_libres_override?: number | null;
}

export async function actualizarDemorasContenedor(
  id: string,
  patch: DemorasContenedorPatch,
): Promise<void> {
  const { error } = await supabase
    .from("embarque_contenedores")
    // SAFE-CAST: columnas nuevas (13.66.11) aún no regeneradas en supabase/types.ts.
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}
