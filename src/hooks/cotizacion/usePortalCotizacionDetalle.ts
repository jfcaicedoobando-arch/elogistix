import { useMemo } from "react";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizacionTypes";
import { calcularSubtotal, calcularIVA } from "@/lib/financialUtils";

interface CotizacionLike {
  conceptos_venta?: unknown;
}

export function usePortalCotizacionDetalle(cot: CotizacionLike | null | undefined) {
  const tasaIva = useTasaIVA();

  return useMemo(() => {
    const conceptos: ConceptoVentaCotizacion[] = Array.isArray(cot?.conceptos_venta)
      ? (cot!.conceptos_venta as unknown as ConceptoVentaCotizacion[])
      : [];

    const conceptosUSD = conceptos.filter((c) => c.moneda === "USD");
    const conceptosMXN = conceptos.filter((c) => c.moneda === "MXN");

    const totalUSD = conceptosUSD.reduce((s, c) => s + (c.total || 0), 0);
    const subtotalMXN = conceptosMXN.reduce(
      (s, c) => s + calcularSubtotal(c.cantidad, c.precio_unitario),
      0,
    );
    const ivaMXN = conceptosMXN.reduce(
      (s, c) => s + calcularIVA(calcularSubtotal(c.cantidad, c.precio_unitario), tasaIva),
      0,
    );
    const totalMXN = subtotalMXN + ivaMXN;

    return { conceptosUSD, conceptosMXN, totalUSD, subtotalMXN, ivaMXN, totalMXN };
  }, [cot, tasaIva]);
}
