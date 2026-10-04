import { roundMoney } from "@/lib/financial/financialUtils";
import { calcularTotalesProforma, type TotalesProforma, type ConceptoVentaLite } from "./proforma";

type TotalesListado = {
  totales_calculados?: TotalesProforma;
  subtotal_usd: number | null; iva_usd: number | null; total_usd: number | null;
  subtotal_mxn: number | null; iva_mxn: number | null; total_mxn: number | null;
};

/** El listado general trae BL-12; queries antiguas conservan su encabezado. */
export function totalesListadoProforma(proforma: TotalesListado): TotalesProforma {
  return proforma.totales_calculados ?? {
    subtotal_usd: roundMoney(Number(proforma.subtotal_usd)),
    iva_usd: roundMoney(Number(proforma.iva_usd)),
    total_usd: roundMoney(Number(proforma.total_usd)),
    subtotal_mxn: roundMoney(Number(proforma.subtotal_mxn)),
    iva_mxn: roundMoney(Number(proforma.iva_mxn)),
    total_mxn: roundMoney(Number(proforma.total_mxn)),
  };
}

/** Lista, CSV y detalle comparten el respaldo cuando no existe desglose. */
export function calcularTotalesProformaConRespaldo(
  proforma: TotalesListado, conceptos: ConceptoVentaLite[], tasaIva: number, advertirDrift = false,
) {
  return conceptos.length
    ? { totales: calcularTotalesProforma(conceptos, tasaIva, {}, advertirDrift ? proforma : undefined), origen: "conceptos" as const }
    : { totales: totalesListadoProforma(proforma), origen: "encabezado_sin_detalle" as const };
}
