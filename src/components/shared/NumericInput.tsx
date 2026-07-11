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
  "aria-label"?: string;
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

    const regex = decimals ? /^\d*\.?\d*$/ : /^\d*$/;

    return (
      <Input
        ref={ref}
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        value={text}
        disabled={disabled}
        placeholder={placeholder ?? "0"}
        aria-label={rest["aria-label"]}
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
