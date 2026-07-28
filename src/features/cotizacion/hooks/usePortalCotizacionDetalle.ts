import { useMemo } from "react";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import {
  calcularDesgloseMoneda,
  parseConceptos,
} from "@/features/cotizacion/domain/parsers/cotizacionDetalle";

interface CotizacionLike {
  conceptos_venta?: unknown;
}

export function usePortalCotizacionDetalle(cot: CotizacionLike | null | undefined) {
  const tasaIva = useTasaIVA();

  return useMemo(() => {
    // B-093: parseo defensivo fila a fila — los conceptos legacy (formato
    // viejo, sin `total`/`tasa_iva_aplicada`/`descripcion`) ya no rompen el
    // render ("USDNaN", Total USD $0.00, fila vacía).
    const conceptos = parseConceptos(cot?.conceptos_venta);

    const conceptosUSD = conceptos.filter((c) => c.moneda === "USD");
    const conceptosMXN = conceptos.filter((c) => c.moneda === "MXN");

    // B-081: desglose por moneda — el USD también puede llevar IVA (la tasa
    // viaja en cada fila) y debe mostrarse desglosado, no escondido en el total.
    const usd = calcularDesgloseMoneda(conceptosUSD, tasaIva);
    const mxn = calcularDesgloseMoneda(conceptosMXN, tasaIva, true); // MXN siempre aplica IVA

    return {
      conceptosUSD,
      conceptosMXN,
      subtotalUSD: usd.subtotal,
      ivaUSD: usd.iva,
      totalUSD: usd.total,
      subtotalMXN: mxn.subtotal,
      ivaMXN: mxn.iva,
      totalMXN: mxn.total,
    };
  }, [cot, tasaIva]);
}
