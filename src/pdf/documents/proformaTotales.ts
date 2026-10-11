import { calcularTotalesProformaConRespaldo } from "@/features/proformas/domain/proformaListado";
import type { ConceptoVentaLite } from "@/features/proformas/domain/proforma";
import type { TotalesMoneda } from "../components/TotalesBox";
import type { ProformaRow } from "./proformaShared";

/** Mismo BL-12 que detalle/listado: con desglose, importes por moneda sin convertir. */
export function totalesProformaPdf(proforma: ProformaRow, conceptos: ConceptoVentaLite[], tasaIva: number) {
  const { totales, origen } = calcularTotalesProformaConRespaldo(proforma, conceptos, tasaIva);
  const bloques: TotalesMoneda[] = [
    { moneda: "USD", subtotal: totales.subtotal_usd, iva: totales.iva_usd, total: totales.total_usd },
    { moneda: "MXN", subtotal: totales.subtotal_mxn, iva: totales.iva_mxn, total: totales.total_mxn },
  ];
  return {
    bloques,
    nota: origen === "encabezado_sin_detalle"
      ? "Detalle de conceptos no disponible. Se conserva el importe guardado."
      : undefined,
  };
}
