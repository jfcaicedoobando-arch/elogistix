/**
 * Cierra una factura de proveedor sin registrar un pago real (compensación,
 * condonación, ajuste histórico, factura duplicada). Registra un ajuste en
 * `pagos_proveedor` con `es_ajuste = true`, marca la factura como Pagada y
 * escribe en bitácora.
 *
 * La lógica de reglas (aprobación, saldo pendiente, permisos) vive en la RPC
 * `cerrar_factura_proveedor_sin_pago`.
 *
 * v13.204.0 · Ola A · A4
 */
import { supabase } from "@/integrations/supabase/client";

export type MotivoCierreSinPago =
  | "compensacion"
  | "condonacion"
  | "ajuste_historico"
  | "duplicada";

export const MOTIVOS_CIERRE_SIN_PAGO: ReadonlyArray<{
  value: MotivoCierreSinPago;
  label: string;
  descripcion: string;
}> = [
  {
    value: "compensacion",
    label: "Compensación",
    descripcion: "Se compensa contra un adeudo del proveedor (NC, saldo a favor, etc.).",
  },
  {
    value: "condonacion",
    label: "Condonación",
    descripcion: "El proveedor perdona el saldo (quita, bonificación comercial).",
  },
  {
    value: "ajuste_historico",
    label: "Ajuste histórico",
    descripcion: "Factura antigua que se salda para limpiar aging (con autorización).",
  },
  {
    value: "duplicada",
    label: "Factura duplicada",
    descripcion: "La factura correcta ya se pagó bajo otro folio.",
  },
] as const;

export async function cerrarFacturaProveedorSinPago(params: {
  facturaId: string;
  motivo: MotivoCierreSinPago;
  comentario?: string;
}): Promise<string> {
  const comentario = params.comentario?.trim();
  const { data, error } = await supabase.rpc("cerrar_factura_proveedor_sin_pago", {
    p_factura_id: params.facturaId,
    p_motivo: params.motivo,
    ...(comentario ? { p_comentario: comentario } : {}),
  });
  if (error) throw error;
  // SAFE-CAST: la RPC `cerrar_factura_proveedor_sin_pago` retorna `uuid` (text)
  // — la firma generada por Supabase la tipa como `unknown` porque acepta
  // parámetro opcional `p_comentario`. La validación de forma la hace la RPC.
  return data as unknown as string;
}
