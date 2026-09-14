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
    const iva = sumarMontos(items.map((concepto) => {
      if (moneda === "USD" && !concepto.aplica_iva) return 0;
      return calcularIVA(
        Number(concepto.cantidad) * Number(concepto.precio_unitario),
        resolverTasaConcepto(concepto, tasaIva),
      );
    }));
    return subtotal + iva;
  };
  return { totalUsd: total("USD"), totalMxn: total("MXN") };
}