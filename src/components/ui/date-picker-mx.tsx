import { useEffect, useRef, useState, useCallback, useId } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
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
}

/**
 * DatePicker localizado para México (formato DD/MM/YYYY visible, valor ISO).
 * Permite capturar la fecha con teclado (máscara) o seleccionarla del calendario.
 */
export function DatePickerMx({
  value, onChange, placeholder = "DD/MM/AAAA", className, title,
}: DatePickerMxProps) {
  const [text, setText] = useState<string>(() => isoToDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  // Sincronizar cuando el value externo cambia (y el input no está en foco)
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(isoToDisplay(value));
      setInvalid(false);
    }
  }, [value]);

  const commit = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setInvalid(false);
      if (value) onChange("");
      return;
    }
    const iso = parseDisplay(trimmed);
    if (iso) {
      setInvalid(false);
      if (iso !== value) onChange(iso);
    } else {
      setInvalid(true);
    }
  }, [onChange, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyMask(e.target.value);
    setText(masked);
    if (invalid) setInvalid(false);
    // Auto-commit cuando ya hay 10 caracteres válidos
    if (masked.length === 10) {
      const iso = parseDisplay(masked);
      if (iso && iso !== value) onChange(iso);
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
    const pegado = e.clipboardData.getData("text");
    if (!pegado) return;
    const iso = parseFlexible(pegado);
    if (iso) {
      e.preventDefault();
      setText(isoToDisplay(iso));
      setInvalid(false);
      if (iso !== value) onChange(iso);
    }
    // Si no se pudo parsear, cae al onChange normal (aplicará máscara sobre los dígitos).
  };

  const handleBlur = () => {
    commit(text);
    // Si quedó inválido, restaurar al último válido
    if (parseDisplay(text) === null && text.trim() !== "") {
      setText(isoToDisplay(value));
      setInvalid(false);
    }
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setText("");
    setInvalid(false);
    onChange("");
  };

  const selectedDate = isoToDate(value);

  return (
    <div
      role="group"
      aria-label={title}
      className={cn(
        "inline-flex items-center h-10 rounded-md border border-input bg-background px-2 gap-1 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0",
        invalid && "border-destructive focus-within:ring-destructive",
        className,
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={title ?? "Abrir calendario"}
            aria-label="Abrir calendario"
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              if (!d) {
                setText("");
                setInvalid(false);
                onChange("");
              } else {
                const iso = dateToIso(d);
                setText(isoToDisplay(iso));
                setInvalid(false);
                onChange(iso);
              }
              setOpen(false);
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>

      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={handleBlur}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        maxLength={10}
        className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />

      {invalid && (
        <span id={errorId} className="sr-only">Fecha inválida</span>
      )}

      {text && (
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
  );
}
