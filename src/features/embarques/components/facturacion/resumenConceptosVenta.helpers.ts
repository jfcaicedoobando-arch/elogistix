import {
  calcularIVA,
  resolverTasaConcepto,
  sumarMontos,
  sumarSubtotales,
} from "@/lib/financial/financialUtils";

interface ConceptoTotalizable {
  cantidad: number | string;
  precio_unitario: number | string;
  moneda: string;
  aplica_iva?: boolean | null;
  tasa_iva_aplicada?: number | null;
  /** SAT 01 — "No objeto"/"Exento" nunca toman la tasa global del resumen. */
  tipo_iva?: string | null;
}

export function sumarConceptosVentaPorMoneda(
  conceptos: ConceptoTotalizable[],
  tasaIva: number,
) {
  const total = (moneda: "MXN" | "USD") => {
    const items = conceptos.filter((concepto) => concepto.moneda === moneda);
    const subtotal = sumarSubtotales(items, (concepto) => ({
      cantidad: Number(concepto.cantidad),
      precioUnitario: Number(concepto.precio_unitario),
    }));
    const iva = sumarMontos(items.map((concepto) =>
      calcularIVA(
        Number(concepto.cantidad) * Number(concepto.precio_unitario),
        resolverTasaConcepto(concepto, tasaIva),
      ),
    ));
    return subtotal + iva;
  };
  return { totalUsd: total("USD"), totalMxn: total("MXN") };
}