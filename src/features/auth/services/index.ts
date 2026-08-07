import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { AUTH_ERROR_MESSAGES } from "@/constants/authMessages";
import type { PostLoginRole } from "@/lib/domain/auth";
import { registrarActividad } from "@/services/bitacora/registrar";

export { resolveLandingRoute } from "@/lib/domain/auth";
export type { PostLoginRole } from "@/lib/domain/auth";
export * from "./session";
export * from "./loginAudit";

/**
 * Devuelve el usuario autenticado actual. Lanza si no hay sesión válida.
 * Útil como fallback cuando el AuthContext aún no hidrató.
 */
export async function getCurrentUser(): Promise<User> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(AUTH_ERROR_MESSAGES.invalidSession);
  return data.user;
}

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

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  redirectTo: string;
}

/**
 * Crea una cuenta nueva en Supabase Auth con metadata de nombre completo
 * y nombre de empresa. El trigger `handle_new_user_signup` en BD usa
 * `company_name` para crear la organización y la membresía admin.
 * Lanza si Supabase devuelve error.
 */
export async function signUpWithEmail(input: SignUpInput & { phone?: string }): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        company_name: input.companyName,
        ...(input.phone ? { phone: input.phone } : {}),
      },
      emailRedirectTo: input.redirectTo,
    },
  });
  if (error) throw new Error(error.message);
}

/**
 * Envía el correo con el enlace para restablecer contraseña.
 * El enlace redirige a `redirectTo` (usualmente `/reset-password`).
 */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw new Error(error.message);
}

/**
 * Actualiza la contraseña del usuario actual (requiere sesión activa, típicamente
 * la sesión efímera generada por el enlace de recovery).
 */
export async function updateUserPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  await registrarActividad({ modulo: "auth", accion: "Cambió su contraseña" });
}
