/**
 * Cierre de sesión en capa `lib/`. AuthContext lo consume desde aquí para
 * no invertir la dependencia hacia `@/features/auth`. El re-export en
 * `features/auth/services/session.ts` mantiene los consumidores actuales.
 */
import { supabase } from "@/integrations/supabase/client";

export async function signOutCurrentSession(): Promise<void> {
  await supabase.auth.signOut();
}
