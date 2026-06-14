/**
 * Servicio de Idempotencia.
 * Wrapper de la RPC `list_idempotency_log` usada por la página de auditoría.
 *
 * Refactor 8.193.0: extraído de `pages/dashboard/Idempotencia.tsx` para
 * mantener la regla "no Supabase en pages/components" (auditoría P0.2).
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";

export interface IdempotenciaRow {
  key: string;
  fn: string;
  hits: number;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  has_response: boolean;
  pending: boolean;
}

export async function listIdempotencyLog(limit = 200, offset = 0): Promise<IdempotenciaRow[]> {
  const { data, error } = await supabase.rpc("list_idempotency_log", {
    _limit: limit,
    _offset: offset,
  });
  if (error) throw error;
  return fromDb<IdempotenciaRow[]>(data ?? []);
}
