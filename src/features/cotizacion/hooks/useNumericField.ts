import { useState, useCallback } from "react";
import { parseInputNumero } from "../utils/parseInputNumero";
import { limpiarSeparadoresMiles } from "@/lib/format/parseMonto";

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
  return parseInputNumero(limpiarSeparadoresMiles(raw));
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
  /**
   * v13.823.286 — formato de presentación cuando el campo NO tiene foco
   * (p. ej. `6100` → `6,100.00` en campos de dinero). Al enfocar se vuelve a
   * mostrar el número plano para editar sin pelear con los separadores; el
   * parseo y el momento del commit no cambian.
   */
  formatDisplay?: (n: number) => string;
}

export function useNumericField(
  value: number,
  commit: (n: number) => void,
  options: Options = {},
): NumericFieldBinding {
  const { parse = parseImporte, fallback = 0, formatDisplay } = options;
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

  const display = value === 0 ? "" : formatDisplay ? formatDisplay(value) : String(value);

  return {
    value: raw ?? display,
    onFocus,
    onChange,
    onBlur,
  };
}
