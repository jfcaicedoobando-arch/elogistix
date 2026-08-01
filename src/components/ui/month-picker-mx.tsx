import { useEffect, useId, useMemo, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  PLACEHOLDER_PERIODO, pickerClearClass, pickerClearIconClass, pickerErrorClass,
  pickerIconClass, pickerRootClass, pickerTriggerClass,
} from "@/components/ui/picker-mx-shell";

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
  disabled?: boolean;
  errorText?: string | null;
  id?: string;
}

/**
 * Selector de mes localizado en español (Mes AAAA).
 * Reemplaza al `<input type="month">` nativo.
 *
 * v13.389.3 — comparte trigger y estados (vacío / deshabilitado / error) con
 * `DatePickerMx` vía `picker-mx-shell`, y el año visible se resincroniza con
 * el valor controlado (antes se quedaba en el año de la primera apertura).
 */
export function MonthPickerMx({
  value, onChange, placeholder = PLACEHOLDER_PERIODO, className, title,
  clearable = true, disabled = false, errorText, id,
}: MonthPickerMxProps) {
  const autoErrorId = useId();
  const errorId = id ? `${id}-error` : autoErrorId;
  const showError = !!errorText;

  const parsed = useMemo(() => {
    if (!value) return null;
    const [y, m] = value.split("-").map(Number);
    if (!y || !m) return null;
    return { year: y, month: m };
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(parsed?.year ?? new Date().getFullYear());

  useEffect(() => {
    if (parsed?.year) setViewYear(parsed.year);
  }, [parsed?.year]);

  const display = parsed ? `${MESES_ES[parsed.month - 1]} ${parsed.year}` : "";

  const select = (monthIdx: number) => {
    const mm = String(monthIdx + 1).padStart(2, "0");
    onChange(`${viewYear}-${mm}`);
  };

  return (
    <div className={cn(pickerRootClass, className)}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            title={title}
            disabled={disabled}
            aria-invalid={showError || undefined}
            aria-describedby={showError ? errorId : undefined}
            className={cn(pickerTriggerClass({ showError, disabled, empty: !value }), "text-left")}
          >
            <CalendarIcon className={pickerIconClass} />
            <span className="flex-1 min-w-0 truncate">{display || placeholder}</span>
            {clearable && value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onChange("");
                }}
                className={pickerClearClass}
                aria-label="Limpiar periodo"
              >
                <X className={pickerClearIconClass} />
              </span>
            )}
          </button>
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
      {showError && <span id={errorId} className={pickerErrorClass}>{errorText}</span>}
    </div>
  );
}
