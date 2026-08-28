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
    <div className="rounded-md border p-3 text-body">
      <div className="flex justify-between">
        <span>Total cotizado:</span>
        <span>{fmt(resumen.total_cotizado, resumen.moneda_total)}</span>
      </div>
      <div className="flex justify-between">
        <span>Total refrescado:</span>
        <span>{fmt(resumen.total_refrescado, resumen.moneda_total)}</span>
      </div>
      <div className="flex justify-between font-semibold">
        <span>Total real:</span>
        <span>{fmt(resumen.total_real, resumen.moneda_total)}</span>
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
      <div className="text-body-sm text-muted-foreground mt-2">
        Totales convertidos a MXN con el tipo de cambio del embarque.
      </div>
      {resumen.filas_sin_tipo_cambio > 0 && (
        <div className="text-body-sm text-destructive mt-1">
          {resumen.filas_sin_tipo_cambio} concepto(s) en moneda extranjera no se
          incluyeron: falta capturar su tipo de cambio en el embarque.
        </div>
      )}
      {versionAceptada != null && (
        <div className="text-body-sm text-muted-foreground mt-2">
          Versión cotizada aceptada: v{versionAceptada}
        </div>
      )}
    </div>
  );
}
