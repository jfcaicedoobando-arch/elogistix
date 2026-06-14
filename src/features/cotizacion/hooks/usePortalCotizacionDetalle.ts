import { useMemo } from "react";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";
import { calcularSubtotal, calcularIVA } from "@/lib/financial/financialUtils";
import { fromDb } from "@/lib/supabase/cast";

interface CotizacionLike {
  conceptos_venta?: unknown;
}

export function usePortalCotizacionDetalle(cot: CotizacionLike | null | undefined) {
  const tasaIva = useTasaIVA();

  return useMemo(() => {
    const conceptos: ConceptoVentaCotizacion[] = Array.isArray(cot?.conceptos_venta)
      ? fromDb<ConceptoVentaCotizacion[]>(cot!.conceptos_venta)
      : [];

    const conceptosUSD = conceptos.filter((c) => c.moneda === "USD");
    const conceptosMXN = conceptos.filter((c) => c.moneda === "MXN");

    const totalUSD = conceptosUSD.reduce((s, c) => s + (c.total || 0), 0);
    const subtotalMXN = conceptosMXN.reduce(
      (s, c) => s + calcularSubtotal(c.cantidad, c.precio_unitario),
      0,
    );
    const ivaMXN = conceptosMXN.reduce((s, c) => {
      const sub = calcularSubtotal(c.cantidad, c.precio_unitario);
      const tasa = c.tasa_iva_aplicada != null && Number.isFinite(c.tasa_iva_aplicada)
        ? Number(c.tasa_iva_aplicada)
        : tasaIva; // MXN siempre aplica IVA (ignora flag aplica_iva)
      return s + calcularIVA(sub, tasa);
    }, 0);
    const totalMXN = subtotalMXN + ivaMXN;

    return { conceptosUSD, conceptosMXN, totalUSD, subtotalMXN, ivaMXN, totalMXN };
  }, [cot, tasaIva]);
}
