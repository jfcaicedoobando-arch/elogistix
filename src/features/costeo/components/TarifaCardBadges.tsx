/**
 * Badges comerciales y operativas de TarifaResultCard.
 * Extraído para cumplir Power of 10 (≤200 líneas).
 */
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Clock, CreditCard, Timer } from "lucide-react";
import { CartaGarantiaIndicator } from "./CartaGarantiaIndicator";
import { usdTarifa } from "@/features/costeo/utils/tarifaFormatters";
import type { TopTarifaRow } from "@/features/costeo/types";

export function TarifaCardBadges({ row }: { row: TopTarifaRow }) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <Badge variant="outline" className="gap-1">
          <CreditCard className="size-3" /> {row.dias_credito} días crédito
        </Badge>
        <CartaGarantiaIndicator row={row} />
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        <Badge variant="outline" className="gap-1">
          <Clock className="size-3" /> {row.dias_libres_demoras} días libres
        </Badge>
        {row.transit_time_dias != null && (
          <Badge variant="outline" className="gap-1">
            <Timer className="size-3" /> {row.transit_time_dias} días tránsito
          </Badge>
        )}
        {row.naviera_demora_dia_6 != null && row.dias_libres_demoras != null && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1 cursor-help">
                <AlertTriangle className="size-3" /> Demora desde el día{" "}
                {row.dias_libres_demoras + 1}: {usdTarifa(row.naviera_demora_dia_6)}/día
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Después de agotar los {row.dias_libres_demoras} días libres, la naviera cobra este
              monto por contenedor y por cada día adicional.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </>
  );
}
