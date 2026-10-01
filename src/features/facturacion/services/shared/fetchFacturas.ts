/**
 * Helper compartido de la proyección/cierre mensual: trae las facturas VIGENTES
 * (con PDF cargado) para un set de expedientes.
 *
 * Fase 3 (crítico #3): acepta `organizationId` para defensa en profundidad.
 * AUD-ANALISIS-2: sólo cuentan CFDI vivos; una factura Cancelada o Sustituida
 * ya no marca el embarque como "Facturado".
 * AUD-ANALISIS-5: trae moneda/subtotal/tipo_cambio para valuar la venta con el
 * TC de la factura (igual que el Tablero).
 */
import { supabase } from "@/integrations/supabase/client";
import { FACTURA_ESTADOS_VIVOS } from "@/lib/domain/estadosFactura";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";

export interface FacturaPorExpediente {
  expediente: string | null;
  factura_pdf_url: string | null;
  moneda: string | null;
  subtotal: number | null;
  tipo_cambio: number | null;
}

export async function fetchFacturasPorExpedientes(
  expedientes: string[],
  organizationId?: string | null,
): Promise<FacturaPorExpediente[]> {
  if (expedientes.length === 0) return [];
  return leerTodasLasPaginas("cierre.facturas", (ini, fin) => {
    let q = supabase
      .from("facturas")
      .select("id, expediente, factura_pdf_url, moneda, subtotal, tipo_cambio")
      .in("expediente", expedientes)
      .not("factura_pdf_url", "is", null)
      .in("estado", [...FACTURA_ESTADOS_VIVOS])
      .is("deleted_at", null);
    if (organizationId) q = q.eq("organization_id", organizationId);
    return q.order("id").range(ini, fin);
  });
}

/**
 * TC USD ponderado por expediente (Σ subtotal×tc / Σ subtotal) de sus facturas
 * USD vigentes. Expedientes sin factura USD con TC válido (>1) no aparecen.
 */
export function tcUsdFacturaPorExpediente(
  facturas: readonly FacturaPorExpediente[],
): Map<string, number> {
  const acc = new Map<string, { base: number; pond: number }>();
  for (const f of facturas) {
    const tc = Number(f.tipo_cambio ?? 0);
    const sub = Number(f.subtotal ?? 0);
    if (!f.expediente || (f.moneda ?? "").toUpperCase() !== "USD") continue;
    if (!(tc > 1) || !(sub > 0)) continue;
    const a = acc.get(f.expediente) ?? { base: 0, pond: 0 };
    a.base += sub;
    a.pond += sub * tc;
    acc.set(f.expediente, a);
  }
  const out = new Map<string, number>();
  for (const [exp, a] of acc) out.set(exp, a.pond / a.base);
  return out;
}
