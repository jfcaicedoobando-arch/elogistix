/**
 * Leads — mutaciones individuales (create/update/softDelete).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, run } from "@/lib/supabase/response";
import { type LeadInput } from "@/features/crm/domain/leads/constants";
import { buildLeadInsertPayload, type AuthLite } from "@/features/crm/domain/leads/leadPayload";

export async function createLead(input: LeadInput, user: AuthLite | null): Promise<{ id: string }> {
  const payload = buildLeadInsertPayload(input, user);
  return unwrap(
    supabase.from("crm_leads").insert(payload).select("id").single(),
  );
}

export async function updateLead(id: string, patch: Partial<LeadInput>): Promise<void> {
  await run(supabase.from("crm_leads").update(patch).eq("id", id));
}

export async function softDeleteLead(id: string, userId: string | null): Promise<void> {
  await run(
    supabase
      .from("crm_leads")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", id),
  );
}
