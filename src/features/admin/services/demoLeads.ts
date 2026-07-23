/**
 * Lectura de leads capturados desde el diálogo "Probar demo".
 * Extraído de `AdminDemoLeads.tsx` (Block 1.6 de la refactor arquitectónica).
 */
import { supabase } from "@/integrations/supabase/client";

export interface DemoLead {
  id: string;
  nombre: string;
  empresa: string;
  email: string;
  telefono_e164: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  created_at: string;
}

const COLUMNS =
  "id, nombre, empresa, email, telefono_e164, utm_source, utm_medium, utm_campaign, referrer, created_at";

export async function fetchDemoLeads(): Promise<DemoLead[]> {
  const { data, error } = await supabase
    .from("demo_leads")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as DemoLead[];
}
