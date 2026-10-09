import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";
import type { TotalesPL } from "@/lib/financial/profitUtils";
import { calcularMargen, calcularUtilidad, sumarSubtotales } from "@/lib/financial/financialUtils";

interface Opciones {
  conceptosDescartados?: number;
  sinCostosRegistrados?: boolean;
}

type ResumenUtilidad = { ok: false; mensaje: string } | {
  ok: true;
  totalesUSD: TotalesPL;
  totalesMXN: TotalesPL;
  tieneVentaUSD: boolean;
  tieneVentaMXN: boolean;
  usaCosteo: boolean;
};

/** Sólo las filas iniciales vacías del editor se pueden ignorar. */
function esPlaceholder(c: ConceptoVentaCotizacion): boolean {
  return c && typeof c.descripcion === "string" && !c.descripcion.trim() && !c.origen_costo_id && c.cantidad === 1 &&
    c.precio_unitario === 0 && c.total === 0;
}

/**
 * El costeo conserva su presupuesto; el resumen comercial usa la venta neta
 * vigente, incluidos manuales y overrides. Nunca se mezclan monedas ni IVA.
 * Sólo la ausencia histórica de conceptos permite respaldarse en el costeo.
 */
export function resumirUtilidadCotizacion(
  costoUSD: TotalesPL,
  costoMXN: TotalesPL,
  conceptos?: ConceptoVentaCotizacion[],
  { conceptosDescartados = 0, sinCostosRegistrados = false }: Opciones = {},
): ResumenUtilidad {
  const ventas = conceptos?.filter(c => !esPlaceholder(c)) ?? [];
  const incompleta = conceptosDescartados > 0 || (Boolean(conceptos?.length) && ventas.length === 0) ||
    ventas.some(c => !c || typeof c.descripcion !== "string" || !c.descripcion.trim() || !["USD", "MXN"].includes(c.moneda) ||
      !Number.isFinite(c.cantidad) || c.cantidad <= 0 ||
      !Number.isFinite(c.precio_unitario) || c.precio_unitario < 0 || !Number.isFinite(c.cantidad * c.precio_unitario));
  if (incompleta) return { ok: false, mensaje: "Revisa los conceptos de venta: la utilidad no se puede calcular con datos incompletos." };
  if (sinCostosRegistrados) return { ok: false, mensaje: "Carga el desglose de costos para calcular la utilidad." };
  if (!conceptos?.length) return { ok: true, totalesUSD: costoUSD, totalesMXN: costoMXN,
    tieneVentaUSD: false, tieneVentaMXN: false, usaCosteo: true };

  const usd = ventas.filter(c => c.moneda === "USD");
  const mxn = ventas.filter(c => c.moneda === "MXN");
  const porMoneda = (costeo: TotalesPL, filas: ConceptoVentaCotizacion[]): TotalesPL => {
    const totalVenta = sumarSubtotales(filas, c => ({ cantidad: c.cantidad, precioUnitario: c.precio_unitario }));
    const totalCosto = costeo.totalCosto;
    return { totalCosto, totalVenta, profit: calcularUtilidad(totalVenta, totalCosto),
      porcentaje: calcularMargen(totalVenta, totalCosto) };
  };
  return { ok: true, totalesUSD: porMoneda(costoUSD, usd), totalesMXN: porMoneda(costoMXN, mxn),
    tieneVentaUSD: usd.length > 0, tieneVentaMXN: mxn.length > 0, usaCosteo: false };
}
