/**
 * Comparativo Presupuesto vs Real por categoría para un periodo (YYYY-MM).
 * Real = proveedor_facturas (por categoria_presupuesto_id) + liquidaciones_comision
 * que caigan en el mes (mapeadas a la categoría "Comisiones" por nombre).
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchCategorias } from "./categorias";
import { fetchPresupuestoMensualAnio } from "./mensual";

export interface FilaVsReal {
  categoria_id: string;
  categoria_nombre: string;
  presupuesto_mxn: number;
  real_mxn: number;
  variacion_mxn: number;
  cumplimiento_pct: number;
}

export interface ResumenVsReal {
  periodo: string;
  filas: FilaVsReal[];
  total_presupuesto_mxn: number;
  total_real_mxn: number;
  variacion_neta_mxn: number;
}

function ultimoDia(periodo: string): string {
  const [y, m] = periodo.split("-").map(Number);
  const d = new Date(y, m, 0);
  return d.toISOString().slice(0, 10);
}

export async function fetchPresupuestoVsReal(
  periodo: string,
  organizationId?: string | null,
): Promise<ResumenVsReal> {
  const [y] = periodo.split("-").map(Number);
  const desde = `${periodo}-01`;
  const hasta = ultimoDia(periodo);

  let cxpQuery = supabase.from("proveedor_facturas")
    .select("categoria_presupuesto_id, total, moneda, tipo_cambio_usd, fecha_emision")
    .gte("fecha_emision", desde).lte("fecha_emision", hasta)
    .is("deleted_at", null)
    .limit(2000);
  let liqQuery = supabase.from("liquidaciones_comision")
    .select("total_mxn, periodo")
    .eq("periodo", periodo)
    .is("deleted_at", null)
    .limit(500);
  if (organizationId) {
    cxpQuery = cxpQuery.eq("organization_id", organizationId);
    liqQuery = liqQuery.eq("organization_id", organizationId);
  }

  const [cats, presupuestoAnio, gastosCxP, liquidaciones] = await Promise.all([
    fetchCategorias(true),
    fetchPresupuestoMensualAnio(y),
    cxpQuery,
    liqQuery,
  ]);

  if (gastosCxP.error) throw gastosCxP.error;
  if (liquidaciones.error) throw liquidaciones.error;

  const presupPorCat = new Map<string, number>();
  for (const p of presupuestoAnio.filter((r) => r.periodo === periodo)) {
    presupPorCat.set(p.categoria_id, Number(p.monto_mxn));
  }

  const realPorCat = new Map<string, number>();
  for (const g of gastosCxP.data ?? []) {
    if (!g.categoria_presupuesto_id) continue;
    const monto = Number(g.total);
    const mxn = g.moneda === "MXN" || !g.tipo_cambio_usd ? monto : monto * Number(g.tipo_cambio_usd);
    realPorCat.set(g.categoria_presupuesto_id, (realPorCat.get(g.categoria_presupuesto_id) ?? 0) + mxn);
  }

  // Liquidaciones de comisión → categoría "Comisiones"
  const comisionesCat = cats.find((c) => c.nombre.toLowerCase() === "comisiones");
  if (comisionesCat) {
    const totalLiq = (liquidaciones.data ?? []).reduce((acc, l) => acc + Number(l.total_mxn), 0);
    if (totalLiq > 0) {
      realPorCat.set(comisionesCat.id, (realPorCat.get(comisionesCat.id) ?? 0) + totalLiq);
    }
  }

  const filas: FilaVsReal[] = cats.map((c) => {
    const presupuesto = presupPorCat.get(c.id) ?? 0;
    const real = realPorCat.get(c.id) ?? 0;
    const variacion = real - presupuesto;
    const cumplimiento = presupuesto > 0 ? (real / presupuesto) * 100 : 0;
    return {
      categoria_id: c.id,
      categoria_nombre: c.nombre,
      presupuesto_mxn: presupuesto,
      real_mxn: real,
      variacion_mxn: variacion,
      cumplimiento_pct: cumplimiento,
    };
  });

  const total_presupuesto = filas.reduce((a, f) => a + f.presupuesto_mxn, 0);
  const total_real = filas.reduce((a, f) => a + f.real_mxn, 0);

  return {
    periodo,
    filas,
    total_presupuesto_mxn: total_presupuesto,
    total_real_mxn: total_real,
    variacion_neta_mxn: total_real - total_presupuesto,
  };
}
