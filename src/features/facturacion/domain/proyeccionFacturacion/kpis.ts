import type { GrupoProyeccion, KpisProyeccion } from "./types";

/** Calcula KPIs agregados sobre los grupos de proyección. */
export function calcularKpisProyeccion(grupos: GrupoProyeccion[]): KpisProyeccion {
  const total = grupos.length;
  const facturadosArr = grupos.filter((g) => g.estado === "Facturado");
  const pendientesArr = grupos.filter((g) => g.estado !== "Facturado");
  const facturados = facturadosArr.length;
  const pendientes = pendientesArr.length;

  const ventaProyMxn = grupos.reduce((s, g) => s + g.ventaMxn, 0);
  const ventaProyUsd = grupos.reduce((s, g) => s + g.ventaUsd, 0);
  const ventaFactMxn = grupos.reduce((s, g) => s + (g.ventaFacturadaMxn ?? (g.estado === "Facturado" ? g.ventaMxn : 0)), 0);
  const ventaFactUsd = grupos.reduce((s, g) => s + (g.ventaFacturadaUsd ?? (g.estado === "Facturado" ? g.ventaUsd : 0)), 0);
  const ventaPendMxn = grupos.reduce((s, g) => s + (g.ventaPendienteMxn ?? (g.estado !== "Facturado" ? g.ventaMxn : 0)), 0);
  const ventaPendUsd = grupos.reduce((s, g) => s + (g.ventaPendienteUsd ?? (g.estado !== "Facturado" ? g.ventaUsd : 0)), 0);
  const costoTotalMxn = grupos.reduce((s, g) => s + g.costoMxn, 0);
  const costoTotalUsd = grupos.reduce((s, g) => s + g.costoUsd, 0);
  const profitProyMxn = ventaProyMxn - costoTotalMxn;
  const profitProyUsd = ventaProyUsd - costoTotalUsd;
  const profitFactMxn = facturadosArr.reduce((s, g) => s + g.profitMxn, 0);

  return {
    totalExpedientes: total,
    facturados,
    pendientes,
    ventaProyMxn,
    ventaFacturadaMxn: ventaFactMxn,
    ventaPendienteMxn: ventaPendMxn,
    costoTotalMxn,
    profitProyMxn,
    profitFacturadoMxn: profitFactMxn,
    ventaProyUsd,
    ventaFacturadaUsd: ventaFactUsd,
    ventaPendienteUsd: ventaPendUsd,
    costoTotalUsd,
    profitProyUsd,
    margenProyPct: ventaProyMxn > 0 ? (profitProyMxn / ventaProyMxn) * 100 : 0,
    avancePct: total > 0 ? (facturados / total) * 100 : 0,
  };
}
