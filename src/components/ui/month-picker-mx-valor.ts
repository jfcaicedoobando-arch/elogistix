/**
 * Estado de captura por teclado de `MonthPickerMx`: texto visible `MM/AAAA`
 * ↔ valor `YYYY-MM`.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const MESES_ES_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/** `YYYY-MM` → `MM/AAAA` (o "" si no es un periodo válido). */
export function ymADisplay(ym: string): string {
  if (!/^\d{4}-\d{2}/.test(ym)) return "";
  return `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;
}

/** Máscara `MM/AAAA` tolerante a separadores tecleados. */
export function aplicarMascaraPeriodo(raw: string): string {
  const limpio = raw.replace(/[^\d/.-]/g, "");
  const conSep = /[/.-]/.test(limpio);
  if (!conSep) {
    const digitos = limpio.replace(/\D/g, "").slice(0, 6);
    if (digitos.length <= 2) return digitos;
    return `${digitos.slice(0, 2)}/${digitos.slice(2, 6)}`;
  }
  const trailing = /[/.-]$/.test(limpio);
  const partes = limpio.split(/[/.-]+/).filter((p, i) => i < 2 && (p !== "" || i === 0));
  const mm = partes[0].slice(0, 2);
  const yyyy = (partes[1] ?? "").slice(0, 4);
  const mmNorm = trailing || yyyy ? mm.padStart(2, "0") : mm;
  if (!yyyy && !trailing) return mmNorm;
  return `${mmNorm}/${yyyy}`;
}

/** `MM/AAAA` → `YYYY-MM`, o `null` si es inválido. */
export function parsearPeriodo(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const mes = Number(m[1]);
  const anio = Number(m[2]);
  if (mes < 1 || mes > 12 || anio < 1900 || anio > 2100) return null;
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

export function useMonthPickerMxValor(value: string, onChange: (v: string) => void) {
  const [text, setText] = useState(() => ymADisplay(value));
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(ymADisplay(value));
      setInvalid(false);
    }
  }, [value]);

  const emitir = useCallback((ym: string) => {
    setText(ymADisplay(ym));
    setInvalid(false);
    if (ym !== value) onChange(ym);
  }, [onChange, value]);

  const commit = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setInvalid(false);
      if (value) onChange("");
      return;
    }
    const ym = parsearPeriodo(trimmed);
    if (ym) { emitir(ym); return; }
    setInvalid(true);
    if (value) onChange("");
  }, [emitir, onChange, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = aplicarMascaraPeriodo(e.target.value);
    setText(masked);
    if (invalid) setInvalid(false);
    if (masked.length === 7) {
      const ym = parsearPeriodo(masked);
      if (ym && ym !== value) onChange(ym);
    } else if (masked.length === 0 && value) {
      onChange("");
    }
  };

  const limpiar = () => {
    setText("");
    setInvalid(false);
    onChange("");
  };

  return { text, invalid, inputRef, commit, handleChange, emitir, limpiar };
}
