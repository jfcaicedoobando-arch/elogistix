/** Prevalidación de lectura: replica el tope del trigger antes de crear la factura. */
import currency from "currency.js";
import { supabase } from "@/integrations/supabase/client";
import { ReglaNegocioError } from "@/lib/errors/reglaNegocio";
import { totalLinea } from "../utils/cuadreConceptos";

interface VinculoPropuesto { monto: number }
interface Costo { id: string; concepto: string; monto: number; moneda: string }
interface VinculoExistente { concepto_costo_id: string | null; monto: number; cantidad?: number | null }

export function detectarSobreasignacionCosto(
  monedaFactura: string,
  vinculos: Record<string, VinculoPropuesto>,
  costos: Costo[],
  existentes: VinculoExistente[],
): string | null {
  const asignado = new Map<string, number>();
  for (const fila of existentes) {
    if (!fila.concepto_costo_id) continue;
    asignado.set(fila.concepto_costo_id, (asignado.get(fila.concepto_costo_id) ?? 0) + totalLinea(fila));
  }
  for (const costo of costos) {
    if (Number(costo.monto) <= 0 || costo.moneda.trim().toUpperCase() !== monedaFactura.trim().toUpperCase()) continue;
    const propuesto = Number(vinculos[costo.id]?.monto ?? 0);
    const limite = currency(Number(costo.monto) * 1.05).value;
    const usado = currency(asignado.get(costo.id) ?? 0).value;
    if (currency(usado + propuesto).value > limite) {
      const disponible = Math.max(0, currency(limite - usado).value);
      return `${costo.concepto}: máximo vinculable ${disponible.toFixed(2)} ${monedaFactura} ` +
        `(costo ${Number(costo.monto).toFixed(2)}, tolerancia 5%). ` +
        "Baja el importe, ajusta el costo del embarque o captura la factura sin este vínculo para conciliarla después.";
    }
  }
  return null;
}

export async function prevalidarVinculosCosto(
  organizationId: string,
  monedaFactura: string,
  vinculos: Record<string, VinculoPropuesto>,
): Promise<void> {
  const ids = Object.keys(vinculos);
  if (!ids.length) return;
  const [{ data: costos, error: errorCostos }, { data: existentes, error: errorVinculos }] = await Promise.all([
    supabase.from("conceptos_costo")
      .select("id, concepto, monto, moneda")
      .eq("organization_id", organizationId).in("id", ids),
    supabase.from("proveedor_facturas_conceptos")
      .select("concepto_costo_id, monto, cantidad")
      .eq("organization_id", organizationId).in("concepto_costo_id", ids),
  ]);
  if (errorCostos) throw errorCostos;
  if (errorVinculos) throw errorVinculos;
  if ((costos ?? []).length !== ids.length) {
    throw new ReglaNegocioError("No se pudieron verificar todos los costos seleccionados. Actualiza la lista antes de guardar la factura.");
  }
  const aviso = detectarSobreasignacionCosto(monedaFactura, vinculos, costos ?? [], existentes ?? []);
  if (aviso) throw new ReglaNegocioError(aviso);
}
