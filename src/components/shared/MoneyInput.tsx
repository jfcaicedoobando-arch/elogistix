/**
 * Campo de dinero estándar (es-MX).
 *
 * - Formato en vivo con separador de miles y cursor estable.
 * - Acepta coma decimal (`1234,50`) y recorta a 2 decimales.
 * - Se puede vaciar por completo: vacío = 0 (sin "0" pegajoso).
 * - Sufijo opcional de moneda (MXN / USD) dentro del campo.
 */
import { forwardRef, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  contarSignificativos,
  formatMoneyDisplay,
  normalizeMoneyText,
  parseMoneyText,
  posicionCursor,
  sanitizeMoneyText,
  valorANumeroTexto,
} from "@/components/shared/utils/moneyInputFormat";

export interface MoneyInputProps {
  value: number | null | undefined;
  onChange: (n: number) => void;
  /** Código de moneda mostrado como sufijo (p.ej. "MXN"). */
  currency?: string;
  allowNegative?: boolean;
  id?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  onBlur?: () => void;
  /** Foco inicial (p. ej. el importe recibido al abrir un diálogo). */
  autoFocus?: boolean;
  /**
   * Ola C · #16: tope superior del importe. Sin él se podían teclear montos
   * absurdos (un cero extra) que sólo reventaban al guardar en la base.
   */
  max?: number;

}

const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      value,
      onChange,
      currency,
      allowNegative = false,
      className,
      disabled,
      placeholder,
      onBlur,
      max,
      ...rest
    },
    ref,
  ) => {
    const [text, setText] = useState<string>(() => valorANumeroTexto(value));
    const textRef = useRef(text);
    textRef.current = text;

    // Sincroniza cuando el valor cambia desde fuera (reset del formulario, etc.).
    useEffect(() => {
      const actual = parseMoneyText(sanitizeMoneyText(textRef.current, allowNegative)) ?? 0;
      if (actual !== (value ?? 0)) setText(valorANumeroTexto(value));
    }, [value, allowNegative]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      const caret = el.selectionStart ?? el.value.length;
      const clean = sanitizeMoneyText(el.value, allowNegative);
      const display = formatMoneyDisplay(clean);
      const significativos = contarSignificativos(el.value, caret);

      setText(display);
      onChange(parseMoneyText(clean) ?? 0);

      // Restaura el cursor tras el re-render (contando dígitos, no comas).
      const pos = posicionCursor(display, significativos);
      requestAnimationFrame(() => {
        if (document.activeElement === el) el.setSelectionRange(pos, pos);
      });
    };

    const handleBlur = () => {
      const clean = sanitizeMoneyText(text, allowNegative);
      const parsed = parseMoneyText(clean) ?? 0;
      const acotado = typeof max === "number" && parsed > max ? max : parsed;
      setText(acotado === parsed ? normalizeMoneyText(clean) : valorANumeroTexto(acotado));
      onChange(acotado);
      onBlur?.();
    };

    return (
      <div className="relative">
        <Input
          {...rest}
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          disabled={disabled}
          placeholder={placeholder ?? "0.00"}
          onFocus={(e) => e.currentTarget.select()}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn("text-right tabular-nums", currency && "pr-12", className)}
        />
        {currency && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
          >
            {currency}
          </span>
        )}
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";

export { MoneyInput };
