/**
 * Reportes y forecast CRM (Fase 5).
 * La derivación pura vive en `src/lib/crm/forecast.ts` (testeable sin Supabase).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  computeForecast,
  computeReportesCRM,
  type EtapaTipo,
  type ForecastResumen,
  type ReportesCRM,
} from "@/lib/crm/forecast";

export type { ForecastResumen, ReportesCRM };

async function fetchEtapaTipos(): Promise<Map<string, EtapaTipo>> {
  const { data, error } = await supabase
    .from("crm_etapas_pipeline")
    .select("id, tipo");
  if (error) throw error;
  return new Map((data ?? []).map((e) => [e.id, e.tipo as EtapaTipo]));
}

export function useForecast(desde?: string, hasta?: string) {
  return useQuery<ForecastResumen>({
    queryKey: ["crm", "forecast", desde, hasta],
    queryFn: async () => {
      const etapaTipos = await fetchEtapaTipos();
      let q = supabase
        .from("crm_oportunidades")
        .select("id, monto_estimado, probabilidad, fecha_estimada_cierre, vendedor_email, etapa_id");
      if (desde) q = q.gte("fecha_estimada_cierre", desde);
      if (hasta) q = q.lte("fecha_estimada_cierre", hasta);
      const { data, error } = await q;
      if (error) throw error;
      return computeForecast(data ?? [], etapaTipos);
    },
  });
}

export function useReportesCRM() {
  return useQuery<ReportesCRM>({
    queryKey: ["crm", "reportes"],
    queryFn: async () => {
      const [leadsR, opsR, motivosR, etapasR] = await Promise.all([
        supabase.from("crm_leads").select("estado, fuente"),
        supabase.from("crm_oportunidades").select("motivo_perdida_id, etapa_id"),
        supabase.from("crm_motivos_perdida").select("id, nombre"),
        supabase.from("crm_etapas_pipeline").select("id, nombre, tipo"),
      ]);
      if (leadsR.error) throw leadsR.error;
      if (opsR.error) throw opsR.error;
      if (motivosR.error) throw motivosR.error;
      if (etapasR.error) throw etapasR.error;

      const motivoNombre = new Map(
        (motivosR.data ?? []).map((m) => [m.id, m.nombre]),
      );
      const etapaInfo = new Map(
        (etapasR.data ?? []).map((e) => [e.id, { nombre: e.nombre, tipo: e.tipo as EtapaTipo }]),
      );

      return computeReportesCRM(
        leadsR.data ?? [],
        opsR.data ?? [],
        etapaInfo,
        motivoNombre,
      );
    },
  });
}
