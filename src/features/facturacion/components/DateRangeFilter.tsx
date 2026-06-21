/**
 * Filtro de rango de fechas para el módulo de Facturación.
 * Dos calendarios (Desde / Hasta) + presets rápidos en es-MX.
 */
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FacturacionDateRange } from "@/features/facturacion/hooks";

interface Props {
  range: FacturacionDateRange;
  onChange: (next: Partial<FacturacionDateRange>) => void;
  onClear: () => void;
  activo: boolean;
}

type Preset = { label: string; build: () => FacturacionDateRange };

function startOfWeek(d: Date): Date {
  // Lunes como inicio de semana (es-MX).
  const day = d.getDay(); // 0 dom .. 6 sáb
  const diff = (day + 6) % 7;
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  return r;
}

const PRESETS: Preset[] = [
  {
    label: "Hoy",
    build: () => {
      const d = new Date();
      return { desde: d, hasta: d };
    },
  },
  {
    label: "Esta semana",
    build: () => ({ desde: startOfWeek(new Date()), hasta: new Date() }),
  },
  {
    label: "Este mes",
    build: () => {
      const d = new Date();
      return { desde: new Date(d.getFullYear(), d.getMonth(), 1), hasta: d };
    },
  },
  {
    label: "Mes anterior",
    build: () => {
      const d = new Date();
      const desde = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const hasta = new Date(d.getFullYear(), d.getMonth(), 0);
      return { desde, hasta };
    },
  },
  {
    label: "Año actual",
    build: () => {
      const d = new Date();
      return { desde: new Date(d.getFullYear(), 0, 1), hasta: d };
    },
  },
];

function formatBtn(d: Date | null, placeholder: string): string {
  return d ? format(d, "dd MMM yyyy", { locale: es }) : placeholder;
}

export function DateRangeFilter({ range, onChange, onClear, activo }: Props) {
  const { desde, hasta } = range;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-muted-foreground mr-1">Periodo:</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("w-[170px] justify-start text-left font-normal", !desde && "text-muted-foreground")}
          >
            {formatBtn(desde, "Desde…")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={es}
            selected={desde ?? undefined}
            onSelect={(d) => onChange({ desde: d ?? null })}
            disabled={(d) => (hasta ? d > hasta : false)}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      <span className="text-muted-foreground">→</span>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("w-[170px] justify-start text-left font-normal", !hasta && "text-muted-foreground")}
          >
            {formatBtn(hasta, "Hasta…")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={es}
            selected={hasta ?? undefined}
            onSelect={(d) => onChange({ hasta: d ?? null })}
            disabled={(d) => (desde ? d < desde : false)}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      <div className="flex flex-wrap gap-1 ml-1">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => {
              const r = p.build();
              onChange({ desde: r.desde, hasta: r.hasta });
            }}
          >
            {p.label}
          </Button>
        ))}
        {activo && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={onClear}
          >
            <X className="h-3 w-3 mr-1" />
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
}
