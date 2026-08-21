import { toTitleCase } from "@/lib/formatters";

/**
 * Casing único para nombres de cliente/proveedor mostrados al usuario
 * (breadcrumb, H1 de detalle, tarjetas, etc.). Envuelve `toTitleCase` para
 * que el criterio quede centralizado en un solo lugar: si cambia la regla
 * de presentación de nombres de entidad, sólo se toca esta función.
 */
export function formatNombreEntidad(nombre: string | null | undefined): string {
  return toTitleCase(nombre ?? "");
}
