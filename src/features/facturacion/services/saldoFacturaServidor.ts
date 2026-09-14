/**
 * N9 (v13.823.390) — Saldo canónico de una factura de cliente, calculado por
 * la base con `public.saldo_factura`.
 *
 * La UI interna sumaba `factura_notas_credito.monto` en crudo: una factura MXN
 * con una nota de crédito en USD (a tipo de cambio correcto) mostraba un saldo
 * equivocado y podía inducir un cobro que la BD después rechaza por sobrepago.
 * La conversión vive SÓLO en el canon servidor; aquí no se replica ninguna
 * fórmula de conversión.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchSaldoFacturaServidor(facturaId: string): Promise<number> {
  const { data, error } = await supabase.rpc("saldo_factura", { p_factura_id: facturaId });
  if (error) throw error;
  const n = Number(data ?? 0);
  return Number.isFinite(n) ? n : 0;
}
