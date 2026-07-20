import { useEffect, useRef, useState, useCallback, useId } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  isoToDisplay, isoToDate, dateToIso, applyMask, parseDisplay, parseFlexible,
} from "./date-picker-mx-helpers";

interface DatePickerMxProps {
  /** ISO date string YYYY-MM-DD (o vacío) */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
  /** Deshabilita todos los controles (input, botones, popover). */
  disabled?: boolean;
  /** Solo lectura (permite abrir el picker pero no editar). */
  readOnly?: boolean;
  /** ISO mínimo permitido (inclusivo). */
  min?: string;
  /** ISO máximo permitido (inclusivo). */
  max?: string;
  /** Mensaje visible bajo el input (además del estado inválido interno). */
  errorText?: string | null;
  /** id/name para labels externos y RHF. */
  id?: string;
  name?: string;
}

function isoInRange(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

/**
 * DatePicker localizado para México (formato DD/MM/YYYY visible, valor ISO).
 * Permite capturar la fecha con teclado (máscara), pegar formatos flexibles
 * (D/M/YYYY, ISO, "13 de marzo de 2026") o seleccionarla del calendario.
 */
export function DatePickerMx({
  value, onChange, placeholder = "DD/MM/AAAA", className, title,
  disabled = false, readOnly = false, min, max, errorText, id, name,
}: DatePickerMxProps) {
  const [text, setText] = useState<string>(() => isoToDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoErrorId = useId();
  const errorId = id ? `${id}-error` : autoErrorId;

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(isoToDisplay(value));
      setInvalid(false);
    }
  }, [value]);

  const emitIfValid = useCallback((iso: string): boolean => {
    if (!isoInRange(iso, min, max)) {
      setInvalid(true);
      return false;
    }
    setInvalid(false);
    if (iso !== value) onChange(iso);
    return true;
  }, [min, max, onChange, value]);

  const commit = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setInvalid(false);
      if (value) onChange("");
      return;
    }
    // 1) intento estricto DD/MM/YYYY.
    const strict = parseDisplay(trimmed);
    if (strict) { emitIfValid(strict); return; }
    // 2) fallback tolerante (D/M/YYYY, ISO, "13 de marzo de 2026").
    const flex = parseFlexible(trimmed);
    if (flex) {
      setText(isoToDisplay(flex));
      emitIfValid(flex);
      return;
    }
    setInvalid(true);
  }, [emitIfValid, onChange, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return;
    const masked = applyMask(e.target.value);
    setText(masked);
    if (invalid) setInvalid(false);
    if (masked.length === 10) {
      const iso = parseDisplay(masked);
      if (iso) emitIfValid(iso);
    } else if (masked.length === 0 && value) {
      onChange("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(text);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (disabled || readOnly) return;
    const pegado = e.clipboardData.getData("text");
    if (!pegado) return;
    const iso = parseFlexible(pegado);
    if (iso) {
      e.preventDefault();
      setText(isoToDisplay(iso));
      emitIfValid(iso);
    }
  };

  const handleBlur = () => {
    commit(text);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || readOnly) return;
    setText("");
    setInvalid(false);
    onChange("");
  };

  const selectedDate = isoToDate(value);
  const minDate = min ? isoToDate(min) : undefined;
  const maxDate = max ? isoToDate(max) : undefined;
  const dayDisabled: Array<{ before?: Date; after?: Date }> = [];
  if (minDate) dayDisabled.push({ before: minDate });
  if (maxDate) dayDisabled.push({ after: maxDate });

  const showError = invalid || !!errorText;
  const describedBy = showError ? errorId : undefined;

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <div
        role="group"
        aria-label={title}
        aria-disabled={disabled || undefined}
        className={cn(
          "inline-flex items-center h-10 rounded-md border border-input bg-background px-2 gap-1 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0",
          showError && "border-destructive focus-within:ring-destructive",
          disabled && "opacity-50 cursor-not-allowed bg-muted",
        )}
      >
        <Popover open={open} onOpenChange={(o) => { if (!disabled) setOpen(o); }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              title={title ?? "Abrir calendario"}
              aria-label="Abrir calendario"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <CalendarIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate ?? maxDate ?? minDate}
              disabled={dayDisabled.length ? dayDisabled : undefined}
              onSelect={(d) => {
                if (!d) {
                  setText("");
                  setInvalid(false);
                  onChange("");
                } else {
                  const iso = dateToIso(d);
                  setText(isoToDisplay(iso));
                  emitIfValid(iso);
                }
                setOpen(false);
              }}
              autoFocus
              locale={es}
              captionLayout="dropdown"
              startMonth={new Date(1900, 0)}
              endMonth={new Date(2100, 11)}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={showError || undefined}
          aria-describedby={describedBy}
          maxLength={10}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />

        {text && !disabled && !readOnly && (
          <button
            type="button"
            onClick={clear}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
            aria-label="Limpiar fecha"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {showError && (
        <span id={errorId} className="text-xs text-destructive">
          {errorText ?? "Fecha inválida. Usa DD/MM/AAAA."}
        </span>
      )}
    </div>
  );
}
