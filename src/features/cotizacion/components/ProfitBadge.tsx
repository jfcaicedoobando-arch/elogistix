import * as React from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Badges de rentabilidad compartidos por Cotización y Profit.
 * Promovidos a `components/shared` en el Bloque 2.3 (arquitectura) para
 * evitar imports cross-feature: antes vivían en `features/profit/components`
 * y eran consumidos por 4 archivos de `features/cotizacion`.
 */

/** Muestra un badge de porcentaje de profit coloreado según el nivel */
export function ProfitBadge({ porcentaje }: { porcentaje: number }): React.JSX.Element {
  if (porcentaje > 15) return <Badge className="bg-success/15 text-success border-success/30">{porcentaje.toFixed(1)}%</Badge>;
  if (porcentaje > 0) return <Badge className="bg-warning/15 text-warning border-warning/30">{porcentaje.toFixed(1)}%</Badge>;
  if (porcentaje < 0) return <Badge className="bg-destructive/15 text-destructive border-destructive/30">{porcentaje.toFixed(1)}%</Badge>;
  return <Badge variant="secondary">0%</Badge>;
}

/** Badge global de rentabilidad basado en porcentajes USD y MXN */
export function RentabilidadGlobalBadge({
  porcentajeUSD, porcentajeMXN, tieneUSD, tieneMXN,
}: {
  porcentajeUSD: number; porcentajeMXN: number; tieneUSD: boolean; tieneMXN: boolean;
}): React.JSX.Element {
  const usdSaludable = !tieneUSD || porcentajeUSD > 15;
  const mxnSaludable = !tieneMXN || porcentajeMXN > 10;
  if (usdSaludable && mxnSaludable && (tieneUSD || tieneMXN))
    return <Badge className="bg-success/15 text-success border-success/30 text-sm">Rentabilidad Saludable</Badge>;
  const usdNegativo = tieneUSD && porcentajeUSD < 0;
  const mxnNegativo = tieneMXN && porcentajeMXN < 0;
  if (usdNegativo || mxnNegativo)
    return <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-sm">Rentabilidad Negativa</Badge>;
  return <Badge className="bg-warning/15 text-warning border-warning/30 text-sm">Rentabilidad Baja</Badge>;
}
