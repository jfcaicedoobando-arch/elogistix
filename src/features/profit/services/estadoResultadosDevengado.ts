/** EERR devengado: el mensual y la tendencia anual comparten bases, fechas y TC. */
import { rangoMes } from "@/features/facturacion/domain/proyeccionFacturacion";
import { fechaFiscalFactura } from "@/features/profit/domain/fechaFiscalFactura";
import type { EstadoResultados } from "@/features/profit/domain/estadoResultados";
import { cargarDatosDevengados, construirEstadoDevengado } from "./estadoResultadosDevengadoDatos";

interface Params {
  organizationId: string | null;
  year: number;
  month: number;
}

export async function fetchEstadoResultadosDevengado(p: Params): Promise<EstadoResultados> {
  const { desde, hasta } = rangoMes(p.year, p.month);
  return construirEstadoDevengado(await cargarDatosDevengados(p.organizationId, desde, hasta));
}

export interface ResumenDevengadoMes {
  mes: number;
  ingresos_mxn: number;
  costos_mxn: number;
}

/**
 * AUD83: una lectura del rango anual, con el mismo cálculo del EERR mensual.
 * Evita la RPC antigua que sumaba IVA y NC brutas con fechas/TC distintos.
 * Los límites permiten que una tendencia entre años lea sólo los meses visibles.
 */
export async function fetchEstadoResultadosDevengadoAnual(p: {
  organizationId: string | null;
  year: number;
  desdeMes?: number;
  hastaMes?: number;
}): Promise<ResumenDevengadoMes[]> {
  const desdeMes = p.desdeMes ?? 1;
  const hastaMes = p.hastaMes ?? 12;
  const { desde } = rangoMes(p.year, desdeMes);
  const { hasta } = rangoMes(p.year, hastaMes);
  const datos = await cargarDatosDevengados(p.organizationId, desde, hasta);
  const filas: ResumenDevengadoMes[] = [];
  for (let mes = desdeMes; mes <= hastaMes; mes++) {
    const periodo = `${p.year}-${String(mes).padStart(2, "0")}`;
    const estado = construirEstadoDevengado({
      ...datos,
      facturas: datos.facturas.filter((f) => fechaFiscalFactura(f).startsWith(periodo)),
      ncs: datos.ncs.filter((nc) => nc.fecha_emision.startsWith(periodo)),
      pfacts: datos.pfacts.filter((pf) => pf.fecha_emision.startsWith(periodo)),
      pncs: datos.pncs.filter((nc) => nc.fecha.startsWith(periodo)),
    });
    filas.push({ mes, ingresos_mxn: estado.totalIngresos.total, costos_mxn: estado.totalCostos.total });
  }
  return filas;
}
