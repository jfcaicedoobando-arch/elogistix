/**
 * Fuentes de Dirección y cálculos locales con el tipo de cambio vigente.
 */
import { mesMasOffset, mesNegocio, type TcFallbacks } from "./mxn";
import { loadCarteraAbierta, loadEmbarques, loadEmbarquesActivos, loadFacturas } from "./loaders";
import {
  agregarEmbarques, calcularAntiguedad, calcularHero, calcularMargen6m,
  calcularMargenPorModo, calcularPulso, calcularTopClientes,
} from "./calculos";
import type { DireccionKpis } from "./tipos";

export async function fetchDireccionKpiSources(orgId: string | null, desdeIso: string) {
  // P1-6: la tendencia/facturado sigue acotada a 6 meses (`loadFacturas`), pero
  // la cartera abierta (aging + vencido) usa `loadCarteraAbierta`, SIN ventana
  // de fechas — de lo contrario una factura viva más vieja desaparece del
  // aging y del total vencido sin haberse cobrado.
  const [embarquesData, facturas, carteraAbierta, activos] = await Promise.all([
    loadEmbarques(orgId, desdeIso),
    loadFacturas(orgId, desdeIso),
    loadCarteraAbierta(orgId),
    loadEmbarquesActivos(orgId),
  ]);
  return { embarquesData, facturas, carteraAbierta, activos };
}

export function calcularDireccionKpis(
  { embarquesData, facturas, carteraAbierta, activos }: Awaited<ReturnType<typeof fetchDireccionKpiSources>>,
  fallbacks: TcFallbacks,
  hoy: Date,
): DireccionKpis {
  const mesActual = mesNegocio(hoy);
  const mesPrev = mesMasOffset(mesActual, -1);
  const aggs = agregarEmbarques(embarquesData.embarques, embarquesData.ventas, embarquesData.costos);
  const antiguedad = calcularAntiguedad(
    carteraAbierta.facturas, carteraAbierta.pagos, fallbacks, hoy, carteraAbierta.ncs,
  );
  return {
    hero: calcularHero({
      aggs, facturas, facturasCartera: carteraAbierta.facturas,
      pagosCartera: carteraAbierta.pagos, ncsCartera: carteraAbierta.ncs,
      antiguedad, fallbacks, hoy, mesActual, mesPrev,
    }),

    margen_6m: calcularMargen6m(aggs, hoy),
    margen_por_modo: calcularMargenPorModo(aggs.filter((a) => a.mes === mesActual)),
    antiguedad,
    top_clientes: calcularTopClientes(aggs.filter((a) => a.mes === mesActual)),
    pulso: calcularPulso(activos, facturas, hoy, mesActual),
  };
}
