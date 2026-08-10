import { supabase } from "@/integrations/supabase/client";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";

export interface CxpPorCapturarRow {
  embarque_id: string;
  expediente: string | null;
  cliente_nombre: string | null;
  presupuestado_mxn: number;
  presupuestado_usd: number;
  facturado_mxn: number;
  facturado_usd: number;
  facturas_capturadas: number;
  ultima_factura_fecha: string | null;
  dias_desde_ultima_factura: number | null;
}

export interface CxpPorPagarRow {
  factura_id: string;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  proveedor_origen: string | null;
  folio_proveedor: string | null;
  embarque_id: string | null;
  expediente: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  dias_para_vencer: number | null;
  moneda: string;
  total: number;
  pagado: number;
  saldo: number;
  estado_captura: string;
  tipo_cambio_usd: number | null;
  fecha_programada_pago: string | null;
}


export interface CarteraPendienteRow {
  factura_id: string;
  numero: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  embarque_id: string | null;
  expediente: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  dias_vencido: number;
  moneda: string;
  total: number;
  pagado: number;
  saldo: number;
  ultimo_contacto: string | null;
  estado: string;
}

export async function fetchCxpPorCapturar(): Promise<CxpPorCapturarRow[]> {
  const { data, error } = await supabase.rpc("cxp_por_capturar");
  if (error) throw error;
  // Ola 4 · N43: la RPC lleva LIMIT 500; sin esto los KPIs mentían en silencio.
  assertNotTruncated(data, 500, "bandejas.cxpPorCapturar");
  return (data ?? []) as CxpPorCapturarRow[];
}

export async function fetchCxpPorPagar(): Promise<CxpPorPagarRow[]> {
  const { data, error } = await supabase.rpc("cxp_por_pagar");
  if (error) throw error;
  // Ola 4 · N43: la RPC lleva LIMIT 500; sin esto los KPIs mentían en silencio.
  assertNotTruncated(data, 500, "bandejas.cxpPorPagar");
  return (data ?? []) as CxpPorPagarRow[];
}



export async function fetchCarteraPendiente(): Promise<CarteraPendienteRow[]> {
  const { data, error } = await supabase.rpc("cartera_pendiente");
  if (error) throw error;
  // Ola 4 · N43: la RPC lleva LIMIT 500; sin esto los KPIs mentían en silencio.
  assertNotTruncated(data, 500, "bandejas.carteraPendiente");
  return (data ?? []) as CarteraPendienteRow[];
}
