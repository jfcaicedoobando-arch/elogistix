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
}

export function AgingMonedaFechaBar({
  monedas, monedaActiva, onMonedaChange, fecha, onFechaChange, idFecha,
}: Props) {
  const monedasVisibles = monedas.length > 0 ? monedas : ["MXN"];
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">Moneda:</span>
        {monedasVisibles.map((m) => (
          <Button
            key={m}
            type="button"
            variant={monedaActiva === m ? "default" : "outline"}
            size="sm"
            aria-pressed={monedaActiva === m}
            onClick={() => onMonedaChange(m)}
            className={cn("h-7 rounded-full px-2.5 text-xs")}
          >
            {m}
          </Button>
        ))}
      </div>
      <div className="w-[200px]">
        <label className="text-xs text-muted-foreground mb-1 block" htmlFor={idFecha}>
          Fecha de corte
        </label>
        <DatePickerMx
          id={idFecha}
          title="Fecha de corte"
          value={fecha}
          onChange={(v: string) => onFechaChange(v || todayLocalISO())}
        />
      </div>
    </div>
  );
}
