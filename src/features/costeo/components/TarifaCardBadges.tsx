/**
 * Badges comerciales y operativas de TarifaResultCard.
 * Extraído para cumplir Power of 10 (≤200 líneas).
 */
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Clock, CreditCard, Timer } from "lucide-react";
import { CartaGarantiaIndicator } from "./CartaGarantiaIndicator";
import { formatCurrency } from "@/lib/formatters";
import type { TopTarifaRow } from "@/features/costeo/types";

export function TarifaCardBadges({ row }: { row: TopTarifaRow }) {
  const monedaDemora = row.naviera_demora_moneda?.trim().toUpperCase();
  const importeDemora = monedaDemora && /^[A-Z]{3}$/.test(monedaDemora)
    ? `${formatCurrency(Number(row.naviera_demora_dia_6), monedaDemora)}/día`
    : "Moneda de demora no disponible";
  const tramoDemora = row.naviera_demora_desde_dia == null
    ? "Tramo no disponible"
    : `Tramo desde el día ${row.naviera_demora_desde_dia}${row.naviera_demora_hasta_dia == null ? " en adelante" : ` hasta el ${row.naviera_demora_hasta_dia}`}`;
  return (
    <>
      <div className="flex flex-wrap gap-1.5 text-body-sm">
        <Badge variant="outline" className="gap-1">
          <CreditCard className="size-3" /> {row.dias_credito} días crédito
        </Badge>
        <CartaGarantiaIndicator row={row} />
      </div>

      <div className="flex flex-wrap gap-1.5 text-body-sm">
        <Badge variant="outline" className="gap-1">
          <Clock className="size-3" /> {row.dias_libres_demoras} días libres
        </Badge>
        {row.transit_time_dias != null && (
          <Badge variant="outline" className="gap-1">
            <Timer className="size-3" /> {row.transit_time_dias} días tránsito
          </Badge>
        )}
        {row.naviera_demora_dia_6 != null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1 cursor-help">
                <AlertTriangle className="size-3" /> Demora (día 6): {importeDemora}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-body-sm">
              Consulta del día 6 del tabulador de la naviera. {tramoDemora}.
              Importe diario por contenedor en la moneda del tramo.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </>
  );
}
