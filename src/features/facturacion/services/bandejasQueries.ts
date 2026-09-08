/**
 * Queries de detalle de las bandejas de trabajo del cockpit de Facturación.
 * Extraído de bandejas.ts para respetar el límite de líneas.
 *
 * v13.823.232: se retiró la bandeja "Por enviar" (y sus helpers de
 * anti-join contra `factura_envios`); el envío por correo sigue
 * disponible desde el detalle de la factura.
 */
import { supabase } from "@/integrations/supabase/client";
import { FECHA_INICIO_TIMBRADO_SISTEMA } from "@/features/facturacion/domain/facturaFlags";
import { warnIfTruncated } from "@/lib/supabase/assertNotTruncated";
import { CAP_LISTA } from "@/constants/queryCaps";

const LIMITE_POR_TIMBRAR = 500;

export interface FilaPorTimbrar {
  id: string;
  numero: string;
  cliente_nombre: string;
  total: number;
  moneda: string;
  fecha_emision: string;
}


export interface FilaRepPendiente {
  id: string;
  factura_id: string;
  factura_numero: string;
  cliente_nombre: string;
  fecha_pago: string;
  monto: number;
  moneda: string;
  estado_rep: string;
}

export async function fetchFacturasPorTimbrar(orgId: string): Promise<FilaPorTimbrar[]> {
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, cliente_nombre, total, moneda, fecha_emision")
    .eq("organization_id", orgId)
    .eq("estado", "Borrador")
    .is("facturapi_id", null)
    .is("deleted_at", null)
    .gte("fecha_emision", FECHA_INICIO_TIMBRADO_SISTEMA.slice(0, 10))
    .order("fecha_emision", { ascending: false })
    .limit(LIMITE_POR_TIMBRAR);
  if (error) throw error;
  warnIfTruncated(data, LIMITE_POR_TIMBRAR, "facturacion.fetchFacturasPorTimbrar");
  return (data ?? []) as FilaPorTimbrar[];
}


export async function fetchPagosRepPendientes(orgId: string): Promise<FilaRepPendiente[]> {
  const { data, error } = await supabase
    .from("pagos_factura")
    .select(
      "id, factura_id, fecha_pago, monto, moneda, estado_rep, facturas!inner(numero, cliente_nombre)",
    )
    .eq("organization_id", orgId)
    .in("estado_rep", ["Pendiente", "Error"])
    // A6: los pagos eliminados no deben aparecer en la bandeja de REP.
    .is("deleted_at", null)
    .order("fecha_pago", { ascending: false })
    .limit(CAP_LISTA);
  if (error) throw error;
  type Row = {
    id: string; factura_id: string; fecha_pago: string;
    monto: number; moneda: string; estado_rep: string;
    facturas: { numero: string; cliente_nombre: string } | null;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    factura_id: r.factura_id,
    factura_numero: r.facturas?.numero ?? "—",
    cliente_nombre: r.facturas?.cliente_nombre ?? "—",
    fecha_pago: r.fecha_pago,
    monto: r.monto,
    moneda: r.moneda,
    estado_rep: r.estado_rep,
  }));
}
