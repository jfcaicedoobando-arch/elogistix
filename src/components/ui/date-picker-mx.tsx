import { useEffect, useRef, useState, useCallback, useId } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isoToDisplay, applyMaskTyping, parseDisplay, parseFlexible,
} from "./date-picker-mx-helpers";

import { DatePickerMxCalendar } from "./date-picker-mx-calendar";
import { manejarTeclaFecha } from "./date-picker-mx-keys";
import {
  MENSAJE_FECHA_INVALIDA, PLACEHOLDER_FECHA, pickerClearClass, pickerClearIconClass,
  pickerErrorClass, pickerRootClass, pickerTriggerClass,
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
  "aria-label"?: string;
}

function isoInRange(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
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
  autoFocus = false, "aria-label": ariaLabel,
}: DatePickerMxProps) {

  const autoErrorId = useId();
  const errorId = id ? `${id}-error` : autoErrorId;
  const {
    text, invalid, open, setOpen, inputRef,
    commit, handleChange, handlePaste, clear, onPick, onCalendarClear,
  } = useDatePickerMxValor({ value, onChange, min, max, disabled, readOnly });


  const showError = invalid || !!errorText;
  const describedBy = showError ? errorId : undefined;

  return (
    <div className={cn(pickerRootClass, className)}>
      <div
        role="group"
        aria-label={title}
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
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          value={text}
          onChange={handleChange}
          onKeyDown={(e) => {
            manejarTeclaFecha(e, {
              open,
              setOpen,
              commit: () => commit(text),
              pendiente: text !== isoToDisplay(value),
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
    </div>
  );
}
