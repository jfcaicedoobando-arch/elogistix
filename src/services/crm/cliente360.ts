/**
 * Servicio CRM — Cliente 360°. Agrega oportunidades, última cotización y último embarque.
 */
import { supabase } from "@/integrations/supabase/client";
import { computeCliente360Totals } from "@/lib/crm/cliente360";
import type { EtapaTipo } from "@/lib/crm/forecast";

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

export async function fetchCliente360(clienteId: string): Promise<Cliente360Resumen> {
  const [opsR, cotR, embR, etapasR] = await Promise.all([
    supabase
      .from("crm_oportunidades")
      .select(
        "id, nombre, etapa_id, monto_estimado, valor_real, moneda, probabilidad, fecha_estimada_cierre, created_at, vendedor_email",
      )
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("cotizaciones")
      .select("id, folio, estado, subtotal, created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("embarques")
      .select("id, expediente, estado, created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("crm_etapas_pipeline").select("id, tipo"),
  ]);
  if (opsR.error) throw opsR.error;
  if (cotR.error) throw cotR.error;
  if (embR.error) throw embR.error;
  if (etapasR.error) throw etapasR.error;

  const tipoEtapa = new Map(
    (etapasR.data ?? []).map((e) => [e.id, e.tipo as EtapaTipo]),
  );
  const oportunidades = (opsR.data ?? []) as Cliente360Oportunidad[];
  const { totalAbierto, totalGanado } = computeCliente360Totals(oportunidades, tipoEtapa);

  return {
    oportunidades,
    totalAbierto,
    totalGanado,
    ultimaCotizacion: (cotR.data?.[0] as Cliente360Resumen["ultimaCotizacion"]) ?? null,
    ultimoEmbarque: (embR.data?.[0] as Cliente360Resumen["ultimoEmbarque"]) ?? null,
  };
}
