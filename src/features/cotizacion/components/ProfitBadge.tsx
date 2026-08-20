import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { MargenBadge } from "@/components/shared/MargenBadge";
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

/** Muestra un badge de porcentaje de profit coloreado según el nivel */
export function ProfitBadge({ porcentaje }: { porcentaje: number }): React.JSX.Element {
  return <MargenBadge pct={porcentaje} umbrales={UMBRAL_MARGEN_COTIZACION} />;
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
