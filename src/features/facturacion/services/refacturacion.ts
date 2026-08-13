/**
 * Servicio del caso de refacturación a otro receptor (Etapa 2 · Ola 12).
 *
 * Envuelve las RPCs creadas en la Etapa 1:
 *  - `abrir_caso_refacturacion`
 *  - `refacturacion_set_paso`
 *  - `duplicar_factura_para_refacturacion`
 *  - `reasignar_pago_factura`
 *  - `cerrar_caso_refacturacion`
 *
 * Todas las validaciones duras viven en la base (LC_REFACT_*); aquí sólo se
 * normaliza el error para que la UI muestre el mensaje amigable.
 */
import { supabase } from "@/integrations/supabase/client";

export type RutaFiscalRefacturacion = "01" | "02";

export interface CasoRefacturacion {
  id: string;
  organization_id: string;
  factura_original_id: string;
  factura_nueva_id: string | null;
  cliente_origen_id: string | null;
  cliente_destino_id: string;
  ruta_fiscal: RutaFiscalRefacturacion;
  motivo: string;
  embarque_id: string | null;
  pago_original_id: string | null;
  pago_nuevo_id: string | null;
  estado: "abierto" | "completado" | "cancelado";
  paso_actual: number;
  created_at: string;
  cerrado_at: string | null;
}

const CASO_COLS =
  "id, organization_id, factura_original_id, factura_nueva_id, cliente_origen_id, " +
  "cliente_destino_id, ruta_fiscal, motivo, embarque_id, pago_original_id, pago_nuevo_id, " +
  "estado, paso_actual, created_at, cerrado_at";

/** Caso vivo (`abierto`) de una factura, o `null` si no hay ninguno. */
export async function obtenerCasoRefacturacion(
  facturaId: string,
): Promise<CasoRefacturacion | null> {
  const { data, error } = await supabase
    .from("refacturaciones")
    .select(CASO_COLS)
    .eq("factura_original_id", facturaId)
    .eq("estado", "abierto")
    .maybeSingle();
  if (error) throw error;
  return (data as CasoRefacturacion | null) ?? null;
}

export interface AbrirCasoInput {
  facturaId: string;
  clienteDestinoId: string;
  rutaFiscal: RutaFiscalRefacturacion;
  motivo: string;
}

export async function abrirCasoRefacturacion(input: AbrirCasoInput): Promise<string> {
  const { data, error } = await supabase.rpc("abrir_caso_refacturacion", {
    p_factura_id: input.facturaId,
    p_cliente_destino_id: input.clienteDestinoId,
    p_ruta_fiscal: input.rutaFiscal,
    p_motivo: input.motivo,
  });
  if (error) throw error;
  return data as string;
}

export async function avanzarPasoRefacturacion(casoId: string, paso: number): Promise<void> {
  const { error } = await supabase.rpc("refacturacion_set_paso", {
    p_caso_id: casoId,
    p_paso: paso,
  });
  if (error) throw error;
}

export async function duplicarFacturaParaRefacturacion(casoId: string): Promise<string> {
  const { data, error } = await supabase.rpc("duplicar_factura_para_refacturacion", {
    p_caso_id: casoId,
  });
  if (error) throw error;
  return data as string;
}

export interface ReasignarPagoInput {
  pagoId: string;
  facturaDestinoId: string;
  casoId: string;
  ordenanteNombre?: string | null;
  ordenanteRfc?: string | null;
}

export async function reasignarPagoFactura(input: ReasignarPagoInput): Promise<string> {
  const { data, error } = await supabase.rpc("reasignar_pago_factura", {
    p_pago_id: input.pagoId,
    p_factura_destino_id: input.facturaDestinoId,
    p_caso_id: input.casoId,
    p_ordenante_nombre: input.ordenanteNombre?.trim() || undefined,
    p_ordenante_rfc: input.ordenanteRfc?.trim() || undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function cerrarCasoRefacturacion(casoId: string, cancelar = false): Promise<void> {
  const { error } = await supabase.rpc("cerrar_caso_refacturacion", {
    p_caso_id: casoId,
    p_cancelar: cancelar,
  });
  if (error) throw error;
}

export interface FacturaRefacturacionEstado {
  id: string;
  numero: string;
  estado: string;
  uuid_fiscal: string | null;
  cliente_nombre: string | null;
  rfc_cliente: string | null;
  total: number | null;
  moneda: string;
}

/** Estado mínimo de la factura nueva (para validar el avance del asistente). */
export async function obtenerEstadoFacturaRefacturacion(
  facturaId: string,
): Promise<FacturaRefacturacionEstado | null> {
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, estado, uuid_fiscal, cliente_nombre, rfc_cliente, total, moneda")
    .eq("id", facturaId)
    .maybeSingle();
  if (error) throw error;
  return (data as FacturaRefacturacionEstado | null) ?? null;
}
