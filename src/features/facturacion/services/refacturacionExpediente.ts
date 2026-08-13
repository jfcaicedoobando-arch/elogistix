/**
 * Expediente de trazabilidad del caso de refacturación (Etapa 3 · Ola 12).
 *
 * Lee la RPC `refacturacion_expediente`, que reúne en una sola llamada el
 * caso, las dos facturas, los pagos involucrados y la línea de tiempo de
 * movimientos (quién y cuándo ejecutó cada paso).
 */
import { supabase } from "@/integrations/supabase/client";

export interface RefacturacionCasoResumen {
  id: string;
  estado: "abierto" | "completado" | "cancelado";
  paso_actual: number;
  ruta_fiscal: "01" | "02";
  motivo: string;
  created_at: string;
  cerrado_at: string | null;
  creado_por_email: string;
  cliente_origen: string | null;
  cliente_destino: string | null;
  embarque_id: string | null;
  embarque_expediente: string | null;
}

export interface RefacturacionFacturaResumen {
  id: string;
  numero: string | null;
  estado: string;
  uuid_fiscal: string | null;
  total: number | null;
  moneda: string | null;
  cancelado_en: string | null;
}

export interface RefacturacionPagoResumen {
  id: string;
  factura_id: string;
  fecha_pago: string;
  monto: number;
  moneda: string;
  uuid_rep: string | null;
  estado_rep: string | null;
  rep_cancelado_en: string | null;
  deleted_at: string | null;
  ordenante_nombre: string | null;
  ordenante_rfc: string | null;
  es_nuevo: boolean;
}

export interface RefacturacionEventoRaw {
  id: string;
  ts: string;
  accion: string;
  usuario_email: string;
  entidad_nombre: string;
  detalles: Record<string, unknown>;
}

export interface RefacturacionExpediente {
  caso: RefacturacionCasoResumen;
  factura_original: RefacturacionFacturaResumen | null;
  factura_nueva: RefacturacionFacturaResumen | null;
  pagos: RefacturacionPagoResumen[];
  eventos: RefacturacionEventoRaw[];
}

/** Expediente completo del caso. */
export async function obtenerExpedienteRefacturacion(
  casoId: string,
): Promise<RefacturacionExpediente> {
  const { data, error } = await supabase.rpc("refacturacion_expediente", {
    p_caso_id: casoId,
  });
  if (error) throw error;
  return data as unknown as RefacturacionExpediente;
}

/** Último caso de refacturación de una factura, en cualquier estado. */
export async function obtenerUltimoCasoIdRefacturacion(
  facturaId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("refacturaciones")
    .select("id")
    .or(`factura_original_id.eq.${facturaId},factura_nueva_id.eq.${facturaId}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
