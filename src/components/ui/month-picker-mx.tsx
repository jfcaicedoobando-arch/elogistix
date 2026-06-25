import { useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MESES_ES_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

interface MonthPickerMxProps {
  /** Valor `YYYY-MM` (o vacío). */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
  clearable?: boolean;
}

/**
 * Selector de mes localizado en español (Mes YYYY).
 * Reemplaza al `<input type="month">` nativo.
 */
export function MonthPickerMx({
  value, onChange, placeholder = "Seleccionar periodo", className, title, clearable = true,
}: MonthPickerMxProps) {
  const parsed = useMemo(() => {
    if (!value) return null;
    const [y, m] = value.split("-").map(Number);
    if (!y || !m) return null;
    return { year: y, month: m };
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(parsed?.year ?? new Date().getFullYear());

  const display = parsed
    ? `${MESES_ES[parsed.month - 1]} ${parsed.year}`
    : "";

  const select = (monthIdx: number) => {
    const mm = String(monthIdx + 1).padStart(2, "0");
    onChange(`${viewYear}-${mm}`);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          title={title}
          className={cn(
            "justify-start text-left font-normal h-10 px-3",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{display || placeholder}</span>
          {clearable && value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onChange("");
              }}
              className="ml-auto rounded p-0.5 hover:bg-muted text-muted-foreground"
              aria-label="Limpiar periodo"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 pointer-events-auto" align="start">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear((y) => y - 1)} aria-label="Año anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-sm font-medium">{viewYear}</div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewYear((y) => y + 1)} aria-label="Año siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MESES_ES_SHORT.map((label, idx) => {
            const isSelected = parsed?.year === viewYear && parsed?.month === idx + 1;
            return (
              <Button
                key={label}
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => select(idx)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
