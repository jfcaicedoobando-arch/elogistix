/**
 * Servicio para registrar leads que solicitan probar la demo.
 * Se ejecuta antes de `enterDemoMode()` para asegurar que tengamos
 * datos de contacto y atribución UTM aunque el visitante abandone
 * dentro de la demo.
 */
import { supabase } from "@/integrations/supabase/client";
import { getAttribution } from "@/features/marketing/lib/attribution";

export interface DemoLeadInput {
  nombre: string;
  empresa: string;
  email: string;
  telefonoE164: string;
}

export async function createDemoLead(input: DemoLeadInput): Promise<void> {
  const attribution = getAttribution();
  const { error } = await supabase.from("demo_leads").insert({
    nombre: input.nombre,
    empresa: input.empresa,
    email: input.email,
    telefono_e164: input.telefonoE164,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_content: attribution.utm_content,
    utm_term: attribution.utm_term,
    referrer: attribution.referrer,
    landing_path: attribution.landing_path,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
  });
  if (error) throw new Error(error.message);
}
