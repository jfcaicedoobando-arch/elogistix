/**
 * Catálogo de usuarios disponibles (resolución de emails desde edge function
 * `user-management` action `list`). Vive en `services/usuario` para que
 * features (comisiones, admin, etc.) compartan el mismo punto de entrada y
 * no haya imports cruzados entre features.
 *
 * Extraído de `features/admin/services/members.ts` en v13.56.2 — auditoría
 * arquitectónica (paso 6: eliminar acoplamiento `comisiones → admin`).
 */
import { supabase } from "@/integrations/supabase/client";

export interface UserOption {
  id: string;
  email: string;
}

export async function fetchAvailableUsers(): Promise<UserOption[]> {
  const { data, error } = await supabase.functions.invoke("user-management", {
    body: { action: "list" },
  });
  if (error) throw error;
  return Array.isArray(data) ? (data as UserOption[]) : [];
}
