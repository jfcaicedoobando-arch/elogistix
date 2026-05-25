/**
 * Vista 360° de un cliente para el tab CRM dentro de ClienteDetalle (Sprint D).
 * Agrega oportunidades, última cotización y último embarque.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Cliente360Oportunidad {
  id: string;
  nombre: string;
  etapa_id: string;
  monto_estimado: number;
  valor_real: number | null;
  moneda: string;
  probabilidad: number;
  fecha_estimada_cierre: string | null;
  created_at: string;
  vendedor_email: string;
}

export interface Cliente360Resumen {
  oportunidades: Cliente360Oportunidad[];
  totalAbierto: number;
  totalGanado: number;
  ultimaCotizacion: { id: string; folio: string; estado: string; subtotal: number; created_at: string } | null;
  ultimoEmbarque: { id: string; expediente: string; estado: string; created_at: string } | null;
}

export function useCliente360(clienteId: string | undefined) {
  return useQuery<Cliente360Resumen>({
    queryKey: ["crm", "cliente-360", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const [opsR, cotR, embR, etapasR] = await Promise.all([
        supabase
          .from("crm_oportunidades")
          .select(
            "id, nombre, etapa_id, monto_estimado, valor_real, moneda, probabilidad, fecha_estimada_cierre, created_at, vendedor_email",
          )
          .eq("cliente_id", clienteId!)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("cotizaciones")
          .select("id, folio, estado, subtotal, created_at")
          .eq("cliente_id", clienteId!)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("embarques")
          .select("id, expediente, estado, created_at")
          .eq("cliente_id", clienteId!)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase.from("crm_etapas_pipeline").select("id, tipo"),
      ]);
      if (opsR.error) throw opsR.error;
      if (cotR.error) throw cotR.error;
      if (embR.error) throw embR.error;
      if (etapasR.error) throw etapasR.error;

      const tipoEtapa = new Map((etapasR.data ?? []).map((e) => [e.id, e.tipo]));
      let totalAbierto = 0;
      let totalGanado = 0;
      const oportunidades = (opsR.data ?? []) as Cliente360Oportunidad[];
      for (const o of oportunidades) {
        const t = tipoEtapa.get(o.etapa_id);
        if (t === "abierta") totalAbierto += Number(o.monto_estimado ?? 0);
        if (t === "ganada") totalGanado += Number(o.valor_real ?? o.monto_estimado ?? 0);
      }

      return {
        oportunidades,
        totalAbierto,
        totalGanado,
        ultimaCotizacion: (cotR.data?.[0] as Cliente360Resumen["ultimaCotizacion"]) ?? null,
        ultimoEmbarque: (embR.data?.[0] as Cliente360Resumen["ultimoEmbarque"]) ?? null,
      };
    },
  });
}
