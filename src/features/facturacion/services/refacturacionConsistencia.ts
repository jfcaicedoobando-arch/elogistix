/**
 * Verificación de consistencia fiscal del caso de refacturación.
 * Envuelve la RPC `public.refacturacion_validar_consistencia`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ImportesFactura } from "@/features/facturacion/domain/refacturacionValidaciones";

export interface HallazgoConsistencia {
  codigo: string;
  mensaje: string;
}

export interface ResumenFacturaConsistencia extends ImportesFactura {
  numero: string | null;
}

export interface ConsistenciaRefacturacion {
  ok: boolean;
  hallazgos: HallazgoConsistencia[];
  factura_original?: ResumenFacturaConsistencia;
  factura_nueva?: ResumenFacturaConsistencia;
  pago_aplicado?: number;
}

export async function validarConsistenciaRefacturacion(
  casoId: string,
): Promise<ConsistenciaRefacturacion> {
  const { data, error } = await supabase.rpc("refacturacion_validar_consistencia", {
    p_caso_id: casoId,
  });
  if (error) throw error;
  // SAFE-CAST: la RPC devuelve jsonb; su forma la garantiza el contrato SQL.
  return data as unknown as ConsistenciaRefacturacion;
}
