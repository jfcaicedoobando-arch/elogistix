/**
 * Orquestador: dispara loaders en paralelo y aplica cálculos puros.
 */
import { inicioMesUtc, ym, ventanaDireccionDesdeIso } from "./mxn";
import { loadEmbarques, loadEmbarquesActivos, loadFacturas } from "./loaders";
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

  const [embarquesData, facturasData, activos] = await Promise.all([
    loadEmbarques(orgId, desdeIso),
    loadFacturas(orgId, desdeIso),
    loadEmbarquesActivos(orgId),
  ]);

  const aggs = agregarEmbarques(embarquesData.embarques, embarquesData.ventas, embarquesData.costos);
  const antiguedad = calcularAntiguedad(facturasData.facturas, facturasData.pagos, fallbackUsdMxn, hoy);
  return {
    hero: calcularHero({ aggs, facturas: facturasData.facturas, antiguedad, fallbackUsd: fallbackUsdMxn, hoy, mesActual, mesPrev }),
    margen_6m: calcularMargen6m(aggs, hoy),
    margen_por_modo: calcularMargenPorModo(aggs.filter((a) => a.mes === mesActual)),
    antiguedad,
    top_clientes: calcularTopClientes(aggs.filter((a) => a.mes === mesActual)),
    pulso: calcularPulso(activos, facturasData.facturas, hoy, mesActual),
  };
}
