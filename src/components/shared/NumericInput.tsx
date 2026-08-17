import { forwardRef, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NumericInputProps {
  value: number;
  onChange: (n: number) => void;
  decimals?: boolean;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Necesario para ligar la etiqueta (`Label htmlFor`) y la navegación por teclado. */
  id?: string;
  name?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}


/**
 * Input numérico amigable:
 * - `type="text"` con `inputMode` numérico (sin spinners ni scroll-to-change).
 * - Estado de texto interno: permite vaciar el campo y evita "01" al teclear sobre el `0` por defecto.
 * - Auto-select al hacer foco para reemplazar el valor rápidamente.
 * - Al perder foco normaliza (`01` → `1`, `""` → `0`, `.5` → `0.5`).
 */
const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onChange, decimals = false, className, disabled, placeholder, ...rest }, ref) => {
    const toText = (n: number): string => (n === 0 ? "" : String(n));
    const [text, setText] = useState<string>(toText(value));
    // Ref al último `text` para leer el valor actual dentro del efecto sin
    // volver a dispararlo (evita loop: efecto → setText → efecto).
    const textRef = useRef(text);
    textRef.current = text;

    // Sincronizar cuando el valor cambia externamente (no por el propio input).
    useEffect(() => {
      const t = textRef.current;
      const current = t === "" || t === "." ? 0 : Number(t);
      if (current !== value) setText(toText(value));
    }, [value]);

    // EC-11: acotar dígitos enteros (12) y decimales (4) para que `Number()`
    // no pierda precisión en silencio (p. ej. 99999999999999999999 → 1e20).
    const regex = decimals ? /^\d{0,12}(\.\d{0,4})?$/ : /^\d{0,12}$/;

    return (
      <Input
        ref={ref}
        {...rest}
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        value={text}
        disabled={disabled}
        placeholder={placeholder ?? "0"}

        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const v = e.target.value;
          if (!regex.test(v)) return;
          setText(v);
          const n = v === "" || v === "." ? 0 : Number(v);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => {
          const n = text === "" || text === "." ? 0 : Number(text);
          const normalized = Number.isFinite(n) ? n : 0;
          setText(toText(normalized));
          onChange(normalized);
        }}
        className={cn("h-8 text-right tabular-nums", className)}
      />
    );
  },
);
NumericInput.displayName = "NumericInput";

export { NumericInput };
