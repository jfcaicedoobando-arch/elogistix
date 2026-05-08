/**
 * Shim de tipos de base de datos.
 *
 * Re-exporta los helpers tipados de `@/integrations/supabase/types` para que
 * componentes y pages no importen directamente de `integrations/` (capa
 * infraestructura). Cuando aparezca un tipo de fila usado en ≥2 lugares,
 * conviene tipar acá un alias de dominio (ej. `export type Cotizacion = Tables<"cotizaciones">`).
 */
export type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "@/integrations/supabase/types";
