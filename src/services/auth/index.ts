import { supabase } from "@/integrations/supabase/client";
import type { PostLoginRole } from "@/lib/domain/auth";

export { resolveLandingRoute } from "@/lib/domain/auth";
export type { PostLoginRole } from "@/lib/domain/auth";

export interface SignInResult {
  userId: string | null;
  role: PostLoginRole;
}

/**
 * Inicia sesión con email/password y devuelve el rol principal del usuario
 * para decidir la ruta de aterrizaje. Lanza si Supabase Auth devuelve error.
 */
export async function signInWithEmail(email: string, password: string): Promise<SignInResult> {
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const userId = signInData.user?.id ?? null;
  if (!userId) return { userId: null, role: null };

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1)
    .single();

  return { userId, role: (roleData?.role ?? null) as PostLoginRole };
}
