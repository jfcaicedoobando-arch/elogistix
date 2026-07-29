/**
 * Servicio — Catálogo de productos/servicios por organización.
 *
 * Encapsula el acceso a `catalogo_claves_sat` para que los hooks/contexts
 * no importen el cliente Supabase directo (regla arquitectónica).
 */
import { TASA_IVA } from "@/lib/financial/financialUtils";
import { supabase } from "@/integrations/supabase/client";

export interface ProductoCatalogo {
  id: string;
  nombre: string;
  clave_sat: string;
  tipo_iva: "gravado_16" | "tasa_0" | "exento";
  tasa_iva_default: number | null;
  clave_unidad_sat: string;
  nombre_unidad: string | null;
}

export async function fetchProductosCatalogo(
  _organizationId: string,
): Promise<ProductoCatalogo[]> {
  const { data, error } = await supabase
    .from("catalogo_claves_sat")
    .select("id, patron, clave_sat, tipo_iva, tasa_iva_default, clave_unidad_sat, nombre_unidad, activo")
    .eq("activo", true)
    .order("patron", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    nombre: r.patron,
    clave_sat: r.clave_sat,
    tipo_iva: r.tipo_iva as ProductoCatalogo["tipo_iva"],
    tasa_iva_default: r.tasa_iva_default,
    clave_unidad_sat: r.clave_unidad_sat,
    nombre_unidad: r.nombre_unidad,
  }));
}

export interface CrearProductoCatalogoInput {
  nombre: string;
  clave_sat: string;
  tipo_iva: ProductoCatalogo["tipo_iva"];
  clave_unidad_sat: string;
}

/**
 * Q-10 (Ola 4): alta rápida de producto/servicio desde el CTA "Crear concepto"
 * del combobox de costos del wizard, sin salir a Configuración.
 */
export async function crearProductoCatalogo(
  organizationId: string,
  input: CrearProductoCatalogoInput,
): Promise<ProductoCatalogo> {
  const { data, error } = await supabase
    .from("catalogo_claves_sat")
    .insert({
      organization_id: organizationId,
      patron: input.nombre,
      clave_sat: input.clave_sat,
      tipo_iva: input.tipo_iva,
      tasa_iva_default: input.tipo_iva === "gravado_16" ? TASA_IVA : 0,
      clave_unidad_sat: input.clave_unidad_sat,
      activo: true,
    })
    .select("id, patron, clave_sat, tipo_iva, tasa_iva_default, clave_unidad_sat, nombre_unidad")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    nombre: data.patron,
    clave_sat: data.clave_sat,
    tipo_iva: data.tipo_iva as ProductoCatalogo["tipo_iva"],
    tasa_iva_default: data.tasa_iva_default,
    clave_unidad_sat: data.clave_unidad_sat,
    nombre_unidad: data.nombre_unidad,
  };
}
