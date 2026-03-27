import type { Enums } from "@/integrations/supabase/types";

/** Centralized role type derived from the database enum */
export type AppRole = Enums<"app_role">;

// Legacy interface kept for NuevoProveedorDialog document step
export interface DocumentoProveedor {
  nombre: string;
  archivo?: string;
  adjuntado: boolean;
}
