import { supabase } from "@/integrations/supabase/client";
import type { TopTarifaRow } from "@/features/costeo/types";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
import { CAP_LOTES_DURO } from "@/constants/queryCaps";
import { ResultadoTruncadoError } from "@/lib/supabase/assertNotTruncated";

/** Vista vigente, acotada explícitamente al tenant solicitado en cada página. */
export async function fetchTarifasPricingOrganizacion(organizationId: string, ids: readonly string[]): Promise<TopTarifaRow[]> {
  if (!organizationId) throw new Error("Selecciona una organización para consultar Pricing.");
  const unicos = [...new Set(ids)];
  if (unicos.length >= CAP_LOTES_DURO) throw new ResultadoTruncadoError("tarifas Pricing", CAP_LOTES_DURO);
  const rows: TopTarifaRow[] = [];
  for (let offset = 0; offset < unicos.length; offset += 200) {
    const lote = unicos.slice(offset, offset + 200);
    const data = await leerTodasLasPaginas("tarifas Pricing de la organización", (desde, hasta) =>
      supabase.from("costeo_tarifas_vigentes_v").select("*").eq("organization_id", organizationId)
        .in("id", lote).order("id").range(desde, hasta));
    // SAFE-CAST: misma vista canónica y contrato TopTarifaRow del servicio de Costeo.
    rows.push(...data as TopTarifaRow[]);
  }
  return rows;
}
