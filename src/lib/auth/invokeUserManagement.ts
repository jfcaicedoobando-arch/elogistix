/**
 * Invoca la Edge Function `user-management` con una sesión vigente.
 * Si el backend responde 401 (token vencido/rotado, típico tras pestaña
 * inactiva), refresca la sesión y reintenta UNA vez antes de devolver el error.
 * Devuelve la misma forma que `supabase.functions.invoke`.
 */
import { supabase } from "@/integrations/supabase/client";
import { ensureFreshSession } from "@/lib/auth/ensureFreshSession";

type InvokeResult<T> = Awaited<ReturnType<typeof supabase.functions.invoke<T>>>;

function es401(error: unknown): boolean {
  const ctx = (error as { context?: { status?: number } } | null)?.context;
  return ctx?.status === 401;
}

export async function invokeUserManagement<T = unknown>(
  body: Record<string, unknown>,
): Promise<InvokeResult<T>> {
  let token = await ensureFreshSession();
  let res: InvokeResult<T> = await supabase.functions.invoke<T>("user-management", {
    body,
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
  if (!res.error || !es401(res.error) || !token) return res;

  const rechazado = token;
  token = await ensureFreshSession(true, rechazado);
  if (!token || token === rechazado) return res;
  res = await supabase.functions.invoke<T>("user-management", {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  return res;
}
