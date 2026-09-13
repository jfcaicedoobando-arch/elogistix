import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { MargenBadge } from "@/components/shared/MargenBadge";
import { Hint } from "@/components/shared/Hint";
import { UMBRAL_MARGEN_COTIZACION } from "@/lib/ui/margen";

/**
 * Badges de rentabilidad compartidos por Cotización y Profit.
 *
 * Ola E · V-1/V-3 — dejan de escribir clases de color a mano
 * (`bg-success/15 text-success ...`) y usan las variantes semánticas de
 * `<Badge />`. Analogía: antes cada badge se pintaba con su propio botecito de
 * pintura; ahora todos toman el color del mismo catálogo.
 */

/** Umbral de rentabilidad sana en MXN (la escala USD vive en `@/lib/ui/margen`). */
const UMBRAL_SANO_USD = UMBRAL_MARGEN_COTIZACION.GOOD;
const UMBRAL_SANO_MXN = 10;

/**
 * Muestra un badge de porcentaje de profit coloreado según el nivel.
 *
 * v13.823.336 — recibe el importe de venta. Sin venta capturada el margen es
 * indeterminado: se muestra "—" en tono neutro (antes decía "0.0%", que se leía
 * como un margen real de cero).
 */
export function ProfitBadge({
  porcentaje, venta,
}: { porcentaje: number; venta?: number | null }): React.JSX.Element {
  const sinVenta = venta !== undefined && venta !== null && !(venta > 0);
  if (sinVenta) {
    return (
      <Hint label="Sin venta capturada">
        <MargenBadge pct={null} venta={0} umbrales={UMBRAL_MARGEN_COTIZACION} label="—" />
      </Hint>
    );
  }
  return <MargenBadge pct={porcentaje} venta={venta ?? undefined} umbrales={UMBRAL_MARGEN_COTIZACION} />;
}

/** Badge global de rentabilidad basado en porcentajes USD y MXN */
export function RentabilidadGlobalBadge({
  porcentajeUSD, porcentajeMXN, tieneUSD, tieneMXN,
}: {
  porcentajeUSD: number; porcentajeMXN: number; tieneUSD: boolean; tieneMXN: boolean;
}): React.JSX.Element {
  const usdSaludable = !tieneUSD || porcentajeUSD > UMBRAL_SANO_USD;
  const mxnSaludable = !tieneMXN || porcentajeMXN > UMBRAL_SANO_MXN;
  if (usdSaludable && mxnSaludable && (tieneUSD || tieneMXN))
    return <Badge variant="success" className="text-body">Rentabilidad Saludable</Badge>;
  const usdNegativo = tieneUSD && porcentajeUSD < 0;
  const mxnNegativo = tieneMXN && porcentajeMXN < 0;
  if (usdNegativo || mxnNegativo)
    return <Badge variant="destructive" className="text-body">Rentabilidad Negativa</Badge>;
  return <Badge variant="warning" className="text-body">Rentabilidad Baja</Badge>;
}
