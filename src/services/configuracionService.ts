/**
 * Servicio de configuración: lectura/escritura de la tabla `configuracion`
 * (organización-scope). Las claves son JSON arbitrario.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface ConfigItem {
  id: string;
  categoria: string;
  clave: string;
  valor: unknown;
  descripcion: string;
  organization_id: string;
}

export async function fetchConfiguracionByOrg(orgId: string): Promise<ConfigItem[]> {
  const { data, error } = await supabase
    .from("configuracion")
    .select("*")
    .eq("organization_id", orgId)
    .order("categoria")
    .order("clave");
  if (error) throw error;
  return (data ?? []) as unknown as ConfigItem[];
}

export async function updateConfiguracionItems(
  items: { id: string; valor: unknown }[],
): Promise<void> {
  for (const item of items) {
    const { error } = await supabase
      .from("configuracion")
      .update({ valor: item.valor as Json })
      .eq("id", item.id);
    if (error) throw error;
  }
}
