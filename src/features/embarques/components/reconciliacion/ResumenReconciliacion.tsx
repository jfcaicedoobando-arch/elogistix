/**
 * Bloque resumen totales + clasificación de la reconciliación a 3 columnas.
 */
import { Badge } from "@/components/ui/badge";
import type { ResumenReconciliacion3C } from "@/lib/domain/versionadoCotizacion";
import { fmt, pct, colorPorClasificacion } from "./reconciliacionFormat";

interface Props {
  resumen: ResumenReconciliacion3C;
  versionAceptada: number | null;
}

export function ResumenReconciliacion({ resumen, versionAceptada }: Props) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex justify-between">
        <span>Total cotizado:</span>
        <span>{fmt(resumen.total_cotizado, "USD")}</span>
      </div>
      <div className="flex justify-between">
        <span>Total refrescado:</span>
        <span>{fmt(resumen.total_refrescado, "USD")}</span>
      </div>
      <div className="flex justify-between font-semibold">
        <span>Total real:</span>
        <span>{fmt(resumen.total_real, "USD")}</span>
      </div>
      <div className="flex justify-between mt-1">
        <span>Δ Cot. vs Real:</span>
        <span>
          {pct(resumen.delta_cot_vs_real.pct)}{" "}
          <Badge className={colorPorClasificacion(resumen.clasificacion)}>
            {resumen.clasificacion}
          </Badge>
        </span>
      </div>
      {versionAceptada != null && (
        <div className="text-xs text-muted-foreground mt-2">
          Versión cotizada aceptada: v{versionAceptada}
        </div>
      )}
    </div>
  );
}
