/**
 * Simulación (vista previa) de una etapa del asistente de refacturación.
 * Envuelve la RPC de sólo lectura `public.refacturacion_simular_paso`:
 * no escribe nada, sólo describe qué se cancela, qué se crea, cómo se
 * reasigna el pago y cómo quedan los saldos antes/después.
 */
import { supabase } from "@/integrations/supabase/client";

export interface AccionSimulada {
  tipo: "rep" | "factura";
  etiqueta: string;
  detalle: string | null;
  monto: number | null;
  moneda: string | null;
}

export interface ReasignacionSimulada {
  pago_fecha: string | null;
  de: string;
  a: string;
  monto: number | null;
  moneda: string | null;
  ordenante_nombre: string | null;
  ordenante_rfc: string | null;
}

export interface SaldoSimulado {
  concepto: string;
  antes: number | null;
  despues: number | null;
  moneda: string;
  nota: string | null;
}

export interface SimulacionPaso {
  paso: number;
  cancela: AccionSimulada[];
  crea: AccionSimulada[];
  reasigna: ReasignacionSimulada | null;
  saldos: SaldoSimulado[];
  bloqueos: string[];
}

export async function simularPasoRefacturacion(
  casoId: string,
  paso: number,
): Promise<SimulacionPaso> {
  const { data, error } = await supabase.rpc("refacturacion_simular_paso", {
    p_caso_id: casoId,
    p_paso: paso,
  });
  if (error) throw error;
  // SAFE-CAST: la RPC devuelve jsonb; su forma la garantiza el contrato SQL.
  const raw = data as unknown as Partial<SimulacionPaso> | null;
  return {
    paso,
    cancela: raw?.cancela ?? [],
    crea: raw?.crea ?? [],
    reasigna: raw?.reasigna ?? null,
    saldos: raw?.saldos ?? [],
    bloqueos: raw?.bloqueos ?? [],
  };
}
