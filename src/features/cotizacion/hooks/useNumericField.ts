import { useState, useCallback } from "react";
import { parseInputNumero } from "../utils/parseInputNumero";

/**
 * R-01 — edición local de campos numéricos en el wizard.
 *
 * Mientras el input tiene foco se conserva el string crudo tecleado y NO se
 * propaga al estado global: eso evita que el re-render reescriba el `value`
 * en medio del tecleo (la causa de que Cant./Costo/Venta se contaminaran
 * entre sí). El valor se parsea y se confirma únicamente en `onBlur`.
 */
/** Importes: los separadores de miles se descartan antes de parsear. */
function parseImporte(raw: string): number {
  return parseInputNumero(raw.replace(/,/g, ""));
}

export interface NumericFieldBinding {
  value: string;
  onFocus: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}

interface Options {
  /** Parser específico del campo (p.ej. `parseCantidad` acepta comas). */
  parse?: (raw: string) => number;
  /** Valor mínimo a confirmar cuando el campo queda vacío. */
  fallback?: number;
}

export function useNumericField(
  value: number,
  commit: (n: number) => void,
  options: Options = {},
): NumericFieldBinding {
  const { parse = parseImporte, fallback = 0 } = options;
  const [raw, setRaw] = useState<string | null>(null);

  const onFocus = useCallback(() => {
    setRaw(value === 0 ? "" : String(value));
  }, [value]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const limpio = e.target.value.replace(/[^0-9.,]/g, "");
    setRaw(limpio);
  }, []);

  const onBlur = useCallback(() => {
    if (raw !== null) commit(raw.trim() === "" ? fallback : parse(raw));
    setRaw(null);
  }, [raw, commit, parse, fallback]);

  return {
    value: raw ?? (value === 0 ? "" : String(value)),
    onFocus,
    onChange,
    onBlur,
  };
}
