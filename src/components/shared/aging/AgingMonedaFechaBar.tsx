/**
 * Barra compartida de las vistas de antigüedad (CxC / CxP):
 * selector de moneda (las monedas no se mezclan) + fecha de corte.
 */
import { Button } from "@/components/ui/button";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { cn } from "@/lib/utils";
import { todayLocalISO } from "@/lib/date/today";

interface Props {
  monedas: readonly string[];
  monedaActiva: string;
  onMonedaChange: (moneda: string) => void;
  fecha: string;
  onFechaChange: (fecha: string) => void;
  /** id único del date picker (accesibilidad). */
  idFecha: string;
  fechaLabel?: string;
}

export function AgingMonedaFechaBar({
  monedas, monedaActiva, onMonedaChange, fecha, onFechaChange, idFecha, fechaLabel = "Fecha de corte",
}: Props) {
  const monedasVisibles = monedas.length > 0 ? monedas : ["MXN"];
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-body-sm text-muted-foreground mr-1">Moneda:</span>
        {monedasVisibles.map((m) => (
          <Button
            key={m}
            type="button"
            variant={monedaActiva === m ? "default" : "outline"}
            size="sm"
            aria-pressed={monedaActiva === m}
            onClick={() => onMonedaChange(m)}
            className={cn("h-7 rounded-full px-2.5 text-body-sm")}
          >
            {m}
          </Button>
        ))}
      </div>
      <div className="w-[200px]">
        <label className="text-body-sm text-muted-foreground mb-1 block" htmlFor={idFecha}>
          {fechaLabel}
        </label>
        <DatePickerMx
          id={idFecha}
          title={fechaLabel}
          value={fecha}
          onChange={(v: string) => onFechaChange(v || todayLocalISO())}
        />
      </div>
    </div>
  );
}
