/**
 * Combina señales del CRM (leads sin contactar, oportunidades abiertas,
 * cotizaciones sin respuesta, actividades vencidas) y devuelve las top N
 * acciones priorizadas para el vendedor — vía `computeNextBestActions`.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActividadesVencidasList } from "./useCrmDashboard";
import { useCotizacionesSinRespuesta } from "./useCotizacionesSinRespuesta";
import { computeNextBestActions, type NbaItem } from "@/lib/crm/nextBestActions";

interface NbaSignals {
  leadsSinContactar: { id: string; empresa: string; created_at: string }[];
  oportunidadesAbiertas: {
    id: string;
    nombre: string;
    fecha_estimada_cierre: string | null;
    updated_at: string;
  }[];
}

function useNbaSignals() {
  const { user } = useAuth();
  return useQuery<NbaSignals>({
    queryKey: ["crm", "nba-signals", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const hace24h = new Date(); hace24h.setDate(hace24h.getDate() - 1);
      const [leadsQ, opsQ] = await Promise.all([
        supabase
          .from("crm_leads")
          .select("id, empresa, created_at")
          .eq("estado", "Nuevo")
          .lte("created_at", hace24h.toISOString())
          .order("created_at", { ascending: true })
          .limit(20),
        supabase
          .from("crm_oportunidades")
          .select("id, nombre, fecha_estimada_cierre, updated_at, crm_etapas_pipeline!inner(tipo)")
          .eq("crm_etapas_pipeline.tipo", "abierta")
          .order("updated_at", { ascending: true })
          .limit(50),
      ]);
      if (leadsQ.error) throw leadsQ.error;
      if (opsQ.error) throw opsQ.error;
      return {
        leadsSinContactar: leadsQ.data ?? [],
        oportunidadesAbiertas: (opsQ.data ?? []).map((o) => ({
          id: o.id,
          nombre: o.nombre,
          fecha_estimada_cierre: o.fecha_estimada_cierre,
          updated_at: o.updated_at,
        })),
      };
    },
  });
}

export function useNextBestActions(limit = 5): { items: NbaItem[]; isLoading: boolean } {
  const { data: signals, isLoading: l1 } = useNbaSignals();
  const { data: cots = [], isLoading: l2 } = useCotizacionesSinRespuesta(5, 10);
  const { data: vencidas = [], isLoading: l3 } = useActividadesVencidasList(10);

  const items = useMemo(() => {
    if (!signals) return [];
    return computeNextBestActions(
      {
        leadsSinContactar: signals.leadsSinContactar,
        oportunidadesAbiertas: signals.oportunidadesAbiertas,
        cotizacionesSinRespuesta: cots,
        actividadesVencidas: vencidas,
      },
      limit,
    );
  }, [signals, cots, vencidas, limit]);

  return { items, isLoading: l1 || l2 || l3 };
}
