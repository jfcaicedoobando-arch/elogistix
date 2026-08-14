import { useId, useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  PICKER_AYUDA_TECLADO, PLACEHOLDER_PERIODO, pickerClearClass, pickerClearIconClass,
  pickerErrorClass, pickerIconClass, pickerRootClass, pickerTriggerClass,
} from "@/components/ui/picker-mx-shell";
import { PATRON_PERIODO } from "./date-picker-mx-segmentos";
import { manejarAtajosSegmento, seleccionarSegmentoEnCursor } from "./date-picker-mx-teclado";
import { MonthPickerMxPanel } from "./month-picker-mx-panel";
import { useMonthPickerMxValor, ymADisplay } from "./month-picker-mx-valor";

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
 * Selector de periodo localizado (captura `MM/AAAA` con teclado numérico).
 *
 * v13.614.0 — antes era sólo un botón con popover: ahora el periodo se puede
 * teclear y soporta los mismos aceleradores que `DatePickerMx`
 * (`T` = mes en curso, `+`/`-` sobre el segmento activo, `←`/`→` para cambiar
 * de segmento, `F4` para abrir la rejilla de meses).
 */
export function MonthPickerMx({
  value, onChange, placeholder = PLACEHOLDER_PERIODO, className, title,
  clearable = true, disabled = false, errorText, id,
}: MonthPickerMxProps) {
  const autoErrorId = useId();
  const errorId = id ? `${id}-error` : autoErrorId;
  const [open, setOpen] = useState(false);
  const {
    text, invalid, inputRef, commit, handleChange, emitir, limpiar,
  } = useMonthPickerMxValor(value, onChange);

  const showError = invalid || !!errorText;

  return (
    <div className={cn(pickerRootClass, className)}>
      <div
        role="group"
        aria-label={title}
        title={title ?? PICKER_AYUDA_TECLADO}
        aria-disabled={disabled || undefined}
        className={cn(pickerTriggerClass({ showError, disabled }))}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={handleChange}
          onFocus={() => seleccionarSegmentoEnCursor(inputRef.current, PATRON_PERIODO)}
          onClick={() => seleccionarSegmentoEnCursor(inputRef.current, PATRON_PERIODO)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && open) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              return;
            }
            if (e.key === "F4" || (e.altKey && e.key === "ArrowDown")) {
              e.preventDefault();
              setOpen(!open);
              return;
            }
            if (e.key === "Enter") {
              commit(text);
              if (text !== ymADisplay(value)) e.preventDefault();
              return;
            }
            manejarAtajosSegmento(e, {
              patron: PATRON_PERIODO,
              modo: "periodo",
              base: value,
              aplicar: emitir,
              inputRef,
              disabled,
            });
          }}
          onBlur={() => commit(text)}
          placeholder="MM/AAAA"
          disabled={disabled}
          aria-label={id ? undefined : (title ?? placeholder)}
          aria-invalid={showError || undefined}
          aria-describedby={showError ? errorId : undefined}
          maxLength={7}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />

        {clearable && text && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              limpiar();
            }}
            className={pickerClearClass}
            aria-label="Limpiar periodo"
          >
            <X className={pickerClearIconClass} />
          </button>
        )}

        <Popover
          open={open}
          onOpenChange={(o) => {
            if (disabled) return;
            setOpen(o);
            if (!o) inputRef.current?.focus();
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label="Abrir selector de mes"
              title="Abrir selector de mes (Alt + Flecha abajo)"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed"
            >
              <CalendarIcon className={pickerIconClass} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 pointer-events-auto" align="start">
            <MonthPickerMxPanel
              value={value}
              onSelect={(ym) => {
                emitir(ym);
                setOpen(false);
                inputRef.current?.focus();
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {showError && (
        <span id={errorId} className={pickerErrorClass}>
          {errorText ?? "Periodo inválido. Usa MM/AAAA."}
        </span>
      )}
    </div>
  );
}
