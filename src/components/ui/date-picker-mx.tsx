import { useId } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isoToDisplay } from "./date-picker-mx-helpers";
import { useDatePickerMxValor } from "./date-picker-mx-valor";

import { DatePickerMxCalendar } from "./date-picker-mx-calendar";
import { manejarTeclaFecha } from "./date-picker-mx-keys";
import { PATRON_FECHA } from "./date-picker-mx-segmentos";
import { manejarAtajosSegmento, seleccionarSegmentoEnCursor } from "./date-picker-mx-teclado";
import { motivoInhabilMx } from "@/lib/date/festivosMx";
import {
  MENSAJE_FECHA_INVALIDA, PICKER_AYUDA_TECLADO, PLACEHOLDER_FECHA, pickerAvisoClass,
  pickerClearClass, pickerClearIconClass, pickerErrorClass, pickerRootClass, pickerTriggerClass,
} from "@/components/ui/picker-mx-shell";



interface DatePickerMxProps {
  /** ISO date string YYYY-MM-DD (o vacío) */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
  title?: string;
  disabled?: boolean;
  readOnly?: boolean;
  min?: string;
  max?: string;
  errorText?: string | null;
  id?: string;
  name?: string;
  /** Enfoca el campo al montar (primer campo de un modal, p. ej.). */
  autoFocus?: boolean;
  /**
   * Muestra un aviso ámbar (sin bloquear) cuando la fecha cae en fin de semana
   * o festivo oficial. Útil en fechas contables: pago, vencimiento, timbrado.
   */
  avisarInhabil?: boolean;
  "aria-label"?: string;
}




/**
 * DatePicker localizado para México (formato DD/MM/YYYY visible, valor ISO).
 * Permite capturar la fecha con teclado (máscara tolerante a separadores),
 * pegar formatos flexibles (D/M/YYYY, ISO, "13 de marzo de 2026") o
 * seleccionarla del calendario (`Alt+Flecha abajo` / `F4`).
 */
export function DatePickerMx({
  value, onChange, placeholder = PLACEHOLDER_FECHA, className, title,
  disabled = false, readOnly = false, min, max, errorText, id, name,
  autoFocus = false, avisarInhabil = false, "aria-label": ariaLabel,
}: DatePickerMxProps) {

  const autoErrorId = useId();
  const errorId = id ? `${id}-error` : autoErrorId;
  const avisoId = `${id ?? autoErrorId}-aviso`;
  const {
    text, invalid, open, setOpen, inputRef,
    commit, handleChange, handlePaste, clear, onPick, onCalendarClear,
  } = useDatePickerMxValor({ value, onChange, min, max, disabled, readOnly });


  const showError = invalid || !!errorText;
  const aviso = !showError && avisarInhabil && value ? motivoInhabilMx(value) : null;
  const describedBy = [showError ? errorId : null, aviso ? avisoId : null]
    .filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn(pickerRootClass, className)}>
      <div
        role="group"
        aria-label={title}
        title={title ?? PICKER_AYUDA_TECLADO}
        aria-disabled={disabled || undefined}
        className={cn(pickerTriggerClass({ showError, disabled }))}
      >
        {/* v13.550.0 — el input va PRIMERO en el DOM: al tabular el foco cae
            directo en la captura de la fecha y no en el icono del calendario. */}
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          value={text}
          onChange={handleChange}
          onFocus={() => seleccionarSegmentoEnCursor(inputRef.current, PATRON_FECHA)}
          onClick={() => seleccionarSegmentoEnCursor(inputRef.current, PATRON_FECHA)}
          onKeyDown={(e) => {
            const consumida = manejarTeclaFecha(e, {
              open,
              setOpen,
              commit: () => commit(text),
              pendiente: text !== isoToDisplay(value),
              disabled,
              readOnly,
            });
            if (consumida) return;
            manejarAtajosSegmento(e, {
              patron: PATRON_FECHA,
              base: value,
              min,
              max,
              aplicar: onPick,
              inputRef,
              disabled,
              readOnly,
            });
          }}
          onPaste={handlePaste}
          onBlur={() => commit(text)}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          aria-label={ariaLabel ?? (id ? undefined : title)}
          aria-invalid={showError || undefined}
          aria-describedby={describedBy}
          maxLength={10}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />

        {text && !disabled && !readOnly && (
          <button
            type="button"
            tabIndex={-1}
            onClick={clear}
            className={pickerClearClass}
            aria-label="Limpiar fecha"
          >
            <X className={pickerClearIconClass} />
          </button>
        )}

        <DatePickerMxCalendar
          value={value}
          marcarInhabiles={avisarInhabil}
          min={min}
          max={max}
          open={open}
          disabled={disabled}
          setOpen={setOpen}
          onPick={onPick}
          onClear={onCalendarClear}
          onCerrar={() => inputRef.current?.focus()}
        />
      </div>
      {showError && (
        <span id={errorId} className={pickerErrorClass}>
          {errorText ?? MENSAJE_FECHA_INVALIDA}
        </span>
      )}
      {aviso && (
        <span id={avisoId} role="status" className={pickerAvisoClass}>
          Día inhábil: {aviso}
        </span>
      )}
    </div>
  );
}
