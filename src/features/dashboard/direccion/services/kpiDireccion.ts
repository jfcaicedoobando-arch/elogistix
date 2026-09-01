/**
 * Orquestador: dispara loaders en paralelo y aplica cálculos puros.
 */
import { inicioMesUtc, ym, ventanaDireccionDesdeIso } from "./mxn";
import { loadCarteraAbierta, loadEmbarques, loadEmbarquesActivos, loadFacturas } from "./loaders";
import {
  agregarEmbarques, calcularAntiguedad, calcularHero, calcularMargen6m,
  calcularMargenPorModo, calcularPulso, calcularTopClientes,
} from "./calculos";
import type { DireccionKpis } from "./tipos";

export async function fetchDireccionKpis(
  orgId: string | null, fallbackUsdMxn: number, hoy: Date = new Date(),
): Promise<DireccionKpis> {
  const base = inicioMesUtc(hoy);
  const desdeIso = ventanaDireccionDesdeIso(hoy);

  const mesActual = ym(base);
  const mesPrev = ym(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1)));

  // P1-6: la tendencia/facturado sigue acotada a 6 meses (`loadFacturas`), pero
  // la cartera abierta (aging + vencido) usa `loadCarteraAbierta`, SIN ventana
  // de fechas — de lo contrario una factura viva más vieja desaparece del
  // aging y del total vencido sin haberse cobrado.
  const [embarquesData, facturasData, carteraAbierta, activos] = await Promise.all([
    loadEmbarques(orgId, desdeIso),
    loadFacturas(orgId, desdeIso),
    loadCarteraAbierta(orgId),
    loadEmbarquesActivos(orgId),
  ]);

  const aggs = agregarEmbarques(embarquesData.embarques, embarquesData.ventas, embarquesData.costos);
  const antiguedad = calcularAntiguedad(
    carteraAbierta.facturas, carteraAbierta.pagos, fallbackUsdMxn, hoy, carteraAbierta.ncs,
  );
  return {
    hero: calcularHero({
      aggs, facturas: facturasData.facturas, facturasCartera: carteraAbierta.facturas,
      pagosCartera: carteraAbierta.pagos, ncsCartera: carteraAbierta.ncs,
      antiguedad, fallbackUsd: fallbackUsdMxn, hoy, mesActual, mesPrev,
    }),

    margen_6m: calcularMargen6m(aggs, hoy),
    margen_por_modo: calcularMargenPorModo(aggs.filter((a) => a.mes === mesActual)),
    antiguedad,
    top_clientes: calcularTopClientes(aggs.filter((a) => a.mes === mesActual)),
    pulso: calcularPulso(activos, facturasData.facturas, hoy, mesActual),
  };
}
