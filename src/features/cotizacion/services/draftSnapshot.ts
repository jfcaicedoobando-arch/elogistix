/** Una sola lectura: identidad, versión, estado y ventas canónicas del borrador. */
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase/response";

const snapshotSchema = z.object({
  id: z.string(), organization_id: z.string(), updated_at: z.string().nullable(),
  estado: z.string(), deleted_at: z.string().nullable(), embarque_id: z.string().nullable(),
  conceptos_venta: z.unknown(), tipo_cambio_usd: z.number().finite().nullable(),
});
export type CotizacionDraftSnapshot = z.infer<typeof snapshotSchema>;

export async function fetchCotizacionDraftSnapshot(id: string, organizationId: string): Promise<CotizacionDraftSnapshot | null> {
  const data = await unwrap(supabase.from("cotizaciones")
    .select("id, organization_id, updated_at, estado, deleted_at, embarque_id, conceptos_venta, tipo_cambio_usd")
    .eq("id", id).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle());
  return data ? snapshotSchema.parse(data) : null;
}
