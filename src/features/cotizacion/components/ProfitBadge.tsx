import { formatPercent } from "@/lib/formatters";
import * as React from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Badges de rentabilidad compartidos por Cotización y Profit.
 *
 * Ola E · V-1/V-3 — dejan de escribir clases de color a mano
 * (`bg-success/15 text-success ...`) y usan las variantes semánticas de
 * `<Badge />`. Analogía: antes cada badge se pintaba con su propio botecito de
 * pintura; ahora todos toman el color del mismo catálogo.
 */

/** Umbrales de rentabilidad (en %) usados por los badges. */
const UMBRAL_SANO_USD = 15;
const UMBRAL_SANO_MXN = 10;

type BadgeTono = "success" | "warning" | "destructive" | "secondary";

function tonoProfit(porcentaje: number): BadgeTono {
  if (porcentaje > UMBRAL_SANO_USD) return "success";
  if (porcentaje > 0) return "warning";
  if (porcentaje < 0) return "destructive";
  return "secondary";
}

/** Muestra un badge de porcentaje de profit coloreado según el nivel */
export function ProfitBadge({ porcentaje }: { porcentaje: number }): React.JSX.Element {
  return <Badge variant={tonoProfit(porcentaje)}>{formatPercent(porcentaje)}</Badge>;
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
    return <Badge variant="success" className="text-sm">Rentabilidad Saludable</Badge>;
  const usdNegativo = tieneUSD && porcentajeUSD < 0;
  const mxnNegativo = tieneMXN && porcentajeMXN < 0;
  if (usdNegativo || mxnNegativo)
    return <Badge variant="destructive" className="text-sm">Rentabilidad Negativa</Badge>;
  return <Badge variant="warning" className="text-sm">Rentabilidad Baja</Badge>;
}
