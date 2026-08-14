/**
 * Captura por teclado de `DateTimePickerMx`: texto `DD/MM/AAAA HH:MM`
 * ↔ valor `YYYY-MM-DDTHH:mm`.
 *
 * La máscara es dirigida por dígitos: el operador teclea `140820260930` y los
 * separadores se insertan solos (`14/08/2026 09:30`).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { parseDisplay } from "./date-picker-mx-helpers";

export const HORA_DEFAULT = "09:00";

/** `YYYY-MM-DDTHH:mm` → `DD/MM/AAAA HH:MM`. */
export function valorADisplay(v: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(v)) return "";
  const fecha = `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;
  const hora = v.slice(11, 16);
  return hora ? `${fecha} ${hora}` : fecha;
}

/** Máscara `DD/MM/AAAA HH:MM` a partir de los dígitos capturados. */
export function aplicarMascaraFechaHora(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 12);
  let out = d.slice(0, 2);
  if (d.length > 2) out += `/${d.slice(2, 4)}`;
  if (d.length > 4) out += `/${d.slice(4, 8)}`;
  if (d.length > 8) out += ` ${d.slice(8, 10)}`;
  if (d.length > 10) out += `:${d.slice(10, 12)}`;
  return out;
}

/** `DD/MM/AAAA HH:MM` → `YYYY-MM-DDTHH:mm`, o `null` si es inválido. */
export function parsearFechaHora(texto: string): string | null {
  const m = texto.trim().match(/^(\d{2}\/\d{2}\/\d{4})(?:[ T](\d{1,2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const iso = parseDisplay(m[1]);
  if (!iso) return null;
  const hh = m[2] === undefined ? 9 : Number(m[2]);
  const mi = m[3] === undefined ? 0 : Number(m[3]);
  if (hh > 23 || mi > 59) return null;
  return `${iso}T${String(hh).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

export function useDateTimePickerMxValor(value: string, onChange: (v: string) => void) {
  const [text, setText] = useState(() => valorADisplay(value));
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(valorADisplay(value));
      setInvalid(false);
    }
  }, [value]);

  const emitir = useCallback((v: string) => {
    setText(valorADisplay(v));
    setInvalid(false);
    if (v !== value) onChange(v);
  }, [onChange, value]);

  const commit = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setInvalid(false);
      if (value) onChange("");
      return;
    }
    const v = parsearFechaHora(trimmed);
    if (v) { emitir(v); return; }
    setInvalid(true);
    if (value) onChange("");
  }, [emitir, onChange, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = aplicarMascaraFechaHora(e.target.value);
    setText(masked);
    if (invalid) setInvalid(false);
    if (masked.length === 16) {
      const v = parsearFechaHora(masked);
      if (v && v !== value) onChange(v);
    } else if (masked.length === 0 && value) {
      onChange("");
    }
  };

  const limpiar = () => {
    setText("");
    setInvalid(false);
    onChange("");
  };

  /** Fecha ISO (`YYYY-MM-DD`) y hora actuales del valor confirmado. */
  const iso = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
  const hora = value.slice(11, 16) || HORA_DEFAULT;

  return { text, invalid, inputRef, iso, hora, commit, handleChange, emitir, limpiar };
}
