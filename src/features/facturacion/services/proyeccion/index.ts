/**
 * Orquestador: trae datos + arma filas de proyección de facturación del mes.
 */
import { rangoMes, type FilaProyeccion } from "@/features/facturacion/domain/proyeccionFacturacion";
import { fetchEmbarquesMes, fetchConceptosYFacturas } from "./fetchSources";
import { indexarPorEmbarque, buildFilasProyeccion } from "./buildFilas";
import { tcUsdFacturaPorExpediente } from "@/features/facturacion/services/shared/fetchFacturas";

export interface ProyeccionMesParams {
  organizationId: string | null;
  year: number;
  month: number;
}

export async function fetchProyeccionMes({
  organizationId,
  year,
  month,
}: ProyeccionMesParams): Promise<FilaProyeccion[]> {
  const { desde, hasta } = rangoMes(year, month);
  const embarques = await fetchEmbarquesMes(organizationId, desde, hasta);
  if (embarques.length === 0) return [];

  const ids = embarques.map((e) => e.id);
  const expedientesUnicos = Array.from(
    new Set(embarques.map((e) => e.expediente).filter((x): x is string => !!x)),
  );

  const { ventas, pendientes, facturadas, costos, facturas } = await fetchConceptosYFacturas(ids, expedientesUnicos, organizationId);
  const ventasMap = indexarPorEmbarque(ventas, "total");
  const costosMap = indexarPorEmbarque(costos, "monto");
  const facturadosSet = new Set<string>(
    facturas.map((f) => f.expediente).filter((x): x is string => !!x),
  );
  // AUD-ANALISIS-5: la venta se valúa con el TC de la factura (como el Tablero).
  const tcFactura = tcUsdFacturaPorExpediente(facturas);

  return buildFilasProyeccion(embarques, ventasMap, costosMap, facturadosSet, {
    tcFacturaPorExpediente: tcFactura, facturadasMap: indexarPorEmbarque(facturadas, "total"),
    pendientesMap: indexarPorEmbarque(pendientes, "total"),
  });
}
