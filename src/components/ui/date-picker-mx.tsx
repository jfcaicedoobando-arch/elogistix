import { useEffect, useRef, useState, useCallback, useId } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isoToDisplay, applyMask, parseDisplay, parseFlexible,
} from "./date-picker-mx-helpers";
import { DatePickerMxCalendar } from "./date-picker-mx-calendar";
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
  value, onChange, placeholder = PLACEHOLDER_FECHA, className, title,
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
      // B-038 (v13.320.48): si el ISO cae fuera de rango, purgar el valor
      // controlado del padre para que RHF/Zod detecten fecha vacía en lugar de
      // arrastrar la ISO stale (que pasaba validación silenciosamente).
      if (value) onChange("");
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
    const strict = parseDisplay(trimmed);
    if (strict) { emitIfValid(strict); return; }
    const flex = parseFlexible(trimmed);
    if (flex) {
      setText(isoToDisplay(flex));
      emitIfValid(flex);
      return;
    }
    setInvalid(true);
    // B-038: texto no parseable — purgar valor previo para no dejar ISO stale.
    if (value) onChange("");
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

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || readOnly) return;
    setText("");
    setInvalid(false);
    onChange("");
  };

  const onPick = (iso: string) => {
    setText(isoToDisplay(iso));
    emitIfValid(iso);
  };
  const onCalendarClear = () => {
    setText("");
    setInvalid(false);
    onChange("");
  };

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
        <DatePickerMxCalendar
          value={value}
          min={min}
          max={max}
          open={open}
          disabled={disabled}
          setOpen={setOpen}
          onPick={onPick}
          onClear={onCalendarClear}
        />

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={handleChange}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(text); } }}
          onPaste={handlePaste}
          onBlur={() => commit(text)}
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
            className={pickerClearClass}
            aria-label="Limpiar fecha"
          >
            <X className={pickerClearIconClass} />
          </button>
        )}
      </div>
      {showError && (
        <span id={errorId} className={pickerErrorClass}>
          {errorText ?? MENSAJE_FECHA_INVALIDA}
        </span>
      )}
    </div>
  );
}
