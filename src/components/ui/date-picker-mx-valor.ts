/**
 * Estado y handlers de valor de `DatePickerMx` (texto visible ↔ ISO),
 * extraídos del componente para respetar el límite Power of 10
 * (≤200 líneas por archivo).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyMaskTyping, isoToDisplay, parseDisplay, parseFlexible,
} from "./date-picker-mx-helpers";

interface Params {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

function isoInRange(iso: string, min?: string, max?: string): boolean {
  if (min && iso < min) return false;
  if (max && iso > max) return false;
  return true;
}

export function useDatePickerMxValor({
  value, onChange, min, max, disabled, readOnly,
}: Params) {
  const [text, setText] = useState<string>(() => isoToDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    // Máscara tolerante: respeta los separadores tecleados (`1/3/2026`).
    const masked = applyMaskTyping(e.target.value);
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

  const limpiar = () => {
    setText("");
    setInvalid(false);
    onChange("");
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (disabled || readOnly) return;
    limpiar();
  };

  const onPick = (iso: string) => {
    setText(isoToDisplay(iso));
    emitIfValid(iso);
  };

  return {
    text, invalid, open, setOpen, inputRef,
    commit, handleChange, handlePaste, clear, onPick, onCalendarClear: limpiar,
  };
}
