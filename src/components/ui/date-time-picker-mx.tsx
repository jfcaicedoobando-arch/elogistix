import { useId, useMemo } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  PLACEHOLDER_FECHA_HORA, pickerClearClass, pickerClearIconClass, pickerErrorClass,
  pickerIconClass, pickerRootClass, pickerTriggerClass,
} from "@/components/ui/picker-mx-shell";

interface DateTimePickerMxProps {
  /** Valor tipo `datetime-local`: `YYYY-MM-DDTHH:mm` (o vacío). */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
  disabled?: boolean;
  errorText?: string | null;
  id?: string;
}

/**
 * DateTime picker localizado para México (DD/MM/AAAA HH:mm).
 * Reemplaza al `<input type="datetime-local">` nativo.
 *
 * v13.389.3 — comparte trigger, placeholder y estados
 * (vacío / deshabilitado / error) con `DatePickerMx` vía `picker-mx-shell`.
 */
export function DateTimePickerMx({
  value, onChange, placeholder = PLACEHOLDER_FECHA_HORA, className, title,
  disabled = false, errorText, id,
}: DateTimePickerMxProps) {
  const autoErrorId = useId();
  const errorId = id ? `${id}-error` : autoErrorId;
  const showError = !!errorText;

  const { date, time } = useMemo(() => {
    if (!value) return { date: undefined as Date | undefined, time: "" };
    const [datePart, timePart = ""] = value.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    if (!y || !m || !d) return { date: undefined, time: "" };
    return { date: new Date(y, m - 1, d), time: timePart.slice(0, 5) };
  }, [value]);

  const display = useMemo(() => {
    if (!date) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}${time ? ` ${time}` : ""}`;
  }, [date, time]);

  const emit = (d: Date | undefined, t: string) => {
    if (!d) {
      onChange("");
      return;
    }
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    onChange(`${iso}T${t || "09:00"}`);
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
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onChange("");
                }}
                className={pickerClearClass}
                aria-label="Limpiar fecha"
              >
                <X className={pickerClearIconClass} />
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => emit(d ?? undefined, time)}
            autoFocus
            locale={es}
          />

          <div className="border-t p-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Hora</span>
            <Input
              type="time"
              value={time || "09:00"}
              onChange={(e) => emit(date, e.target.value)}
              className="h-9 w-32"
            />
          </div>
        </PopoverContent>
      </Popover>
      {showError && <span id={errorId} className={pickerErrorClass}>{errorText}</span>}
    </div>
  );
}
