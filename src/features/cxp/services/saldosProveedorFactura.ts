/**
 * N1 (v13.823.386) — Saldo de facturas de proveedor calculado por el servidor.
 *
 * Antes el listado de CxP y la bandeja de pagos programados sumaban
 * `proveedor_notas_credito.monto` en crudo: una factura MXN con nota de crédito
 * en USD mostraba un saldo equivocado y Tesorería podía programar un pago de
 * más. La vista `public.v_proveedor_facturas_saldo` ya aplica el canon
 * (`monto_pago_en_moneda_factura` para pagos y notas de crédito 'Aplicada'),
 * así que la conversión financiera NO se duplica en TypeScript.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SaldoServidorCxP {
  pagado: number;
  notas_credito: number;
  saldo: number;
}

/** Tamaño de lote del `in(...)` para no exceder el largo de la URL. */
const LOTE_IDS = 200;

function num(v: number | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Devuelve el saldo servidor por factura. La vista respeta RLS
 * (`security_invoker`), así que sólo regresa facturas de la organización activa.
 */
export async function fetchSaldosProveedorFacturas(
  ids: string[],
): Promise<Map<string, SaldoServidorCxP>> {
  const mapa = new Map<string, SaldoServidorCxP>();
  const unicos = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unicos.length; i += LOTE_IDS) {
    const trozo = unicos.slice(i, i + LOTE_IDS);
    const { data, error } = await supabase
      .from("v_proveedor_facturas_saldo")
      .select("proveedor_factura_id, pagado, notas_credito_aplicadas, saldo")
      .in("proveedor_factura_id", trozo);
    if (error) throw error;
    for (const r of data ?? []) {
      if (!r.proveedor_factura_id) continue;
      mapa.set(r.proveedor_factura_id, {
        pagado: num(r.pagado),
        notas_credito: num(r.notas_credito_aplicadas),
        // La vista no clampa a 0 (sirve para detectar sobrepagos); el consumidor
        // decide. Aquí se conserva el valor tal cual.
        saldo: num(r.saldo),
      });
    }
  }
  return mapa;
}
