/**
 * Servicio CRM — Cliente 360°. Agrega oportunidades, última cotización y último embarque.
 */
import { supabase } from "@/integrations/supabase/client";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";
import { computeCliente360Totals, type Cliente360TotalesMoneda } from "@/features/crm/domain/cliente360";
import type { EtapaTipo } from "@/features/crm/domain/forecast";

export type { Cliente360TotalesMoneda } from "@/features/crm/domain/cliente360";

// Cap defensivo para el cálculo de totales (TODO el conjunto, no sólo la
// página mostrada). >5000 oportunidades activas por cliente es señal
// operativa para migrar a RPC con agregación server-side.
const LIMITE_TOTALES = 5000;

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
  /** Totales abierto/ganado por moneda, calculados sobre TODAS las
   * oportunidades del cliente (no limitados a las 50 mostradas en la lista). */
  totales: Cliente360TotalesMoneda[];
  ultimaCotizacion: { id: string; folio: string; estado: string; subtotal: number; created_at: string } | null;
  ultimoEmbarque: { id: string; expediente: string; estado: string; created_at: string } | null;
}

export async function fetchCliente360(clienteId: string): Promise<Cliente360Resumen> {
  const [opsR, totalesR, cotR, embR, etapasR] = await Promise.all([
    supabase
      .from("crm_oportunidades")
      .select(
        "id, nombre, etapa_id, monto_estimado, valor_real, moneda, probabilidad, fecha_estimada_cierre, created_at, vendedor_email",
      )
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
    // Consulta separada, sin el límite de 50 de la lista visible: los KPIs
    // deben reflejar TODO el conjunto de oportunidades del cliente.
    supabase
      .from("crm_oportunidades")
      .select("etapa_id, monto_estimado, valor_real, moneda")
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .limit(LIMITE_TOTALES),
    supabase
      .from("cotizaciones")
      .select("id, folio, estado, subtotal, created_at")
      .eq("cliente_id", clienteId)
      // v13.756.0: ignorar cotizaciones eliminadas en el resumen 360.
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("embarques")
      .select("id, expediente, estado, created_at").is("deleted_at", null)
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase.from("crm_etapas_pipeline").select("id, tipo").is("deleted_at", null),
  ]);
  if (opsR.error) throw opsR.error;
  if (totalesR.error) throw totalesR.error;
  if (cotR.error) throw cotR.error;
  if (embR.error) throw embR.error;
  if (etapasR.error) throw etapasR.error;
  assertNotTruncated(totalesR.data, LIMITE_TOTALES, "crm.cliente360.totales");

  const tipoEtapa = new Map(
    (etapasR.data ?? []).map((e) => [e.id, e.tipo as EtapaTipo]),
  );
  const oportunidades = (opsR.data ?? []) as Cliente360Oportunidad[];
  const totales = computeCliente360Totals(totalesR.data ?? [], tipoEtapa);

  return {
    oportunidades,
    totales,
    ultimaCotizacion: (cotR.data?.[0] as Cliente360Resumen["ultimaCotizacion"]) ?? null,
    ultimoEmbarque: (embR.data?.[0] as Cliente360Resumen["ultimoEmbarque"]) ?? null,
  };
}
