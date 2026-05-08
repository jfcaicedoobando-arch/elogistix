import type { Enums } from "@/integrations/supabase/types";

/** Tipo centralizado de rol de aplicación derivado del enum de la base de datos. */
export type AppRole = Enums<"app_role">;

/**
 * Constantes de roles. Usar `APP_ROLES.ADMIN` en lugar del literal `"admin"`
 * para evitar typos y poder rastrear usos. El tipo `AppRole` sigue siendo la
 * fuente de verdad (deriva del enum `app_role` en BD).
 */
export const APP_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  OPERADOR: "operador",
  VIEWER: "viewer",
  CLIENTE: "cliente",
} as const satisfies Record<string, AppRole>;
