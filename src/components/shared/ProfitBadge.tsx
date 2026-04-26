import { memo } from "react";
import { Badge } from "@/components/ui/badge";

/** Muestra un badge de porcentaje de profit coloreado según el nivel */
function ProfitBadgeBase({ porcentaje }: { porcentaje: number }): JSX.Element {
  if (porcentaje > 15) return <Badge className="bg-success/15 text-success border-success/30">{porcentaje.toFixed(1)}%</Badge>;
  if (porcentaje > 0) return <Badge className="bg-warning/15 text-warning border-warning/30">{porcentaje.toFixed(1)}%</Badge>;
  if (porcentaje < 0) return <Badge className="bg-destructive/15 text-destructive border-destructive/30">{porcentaje.toFixed(1)}%</Badge>;
  return <Badge variant="secondary">0%</Badge>;
}
export const ProfitBadge = memo(ProfitBadgeBase);

/** Badge global de rentabilidad basado en porcentajes USD y MXN */
function RentabilidadGlobalBadgeBase({
  porcentajeUSD, porcentajeMXN, tieneUSD, tieneMXN,
}: {
  porcentajeUSD: number; porcentajeMXN: number; tieneUSD: boolean; tieneMXN: boolean;
}): JSX.Element {
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
export const RentabilidadGlobalBadge = memo(RentabilidadGlobalBadgeBase);
