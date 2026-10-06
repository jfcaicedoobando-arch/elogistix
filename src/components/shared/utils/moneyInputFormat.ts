/**
 * Helpers puros de captura de dinero (es-MX).
 *
 * Separados de `MoneyInput` para poder testearlos aislados y reutilizarlos.
 * Convenciones: punto decimal, coma como separador de miles, máximo 2 decimales.
 */

import { formatNumber } from "@/lib/formatters";

/** Agrupa en miles una cadena de dígitos ("1234567" → "1,234,567"). */
const agruparDigitos = (digitos: string): string => {
  const limpio = digitos.replace(/^0+(?=\d)/, "");
  if (limpio === "") return "";
  return formatNumber(Number(limpio), { decimals: 0 });
};

/**
 * Normaliza lo que el usuario teclea a una cadena "limpia" (`1234.5`).
 * - Acepta coma decimal (`1234,50`) y separadores de miles.
 * - Descarta cualquier carácter que no sea dígito, punto o coma.
 * - Recorta a 2 decimales.
 */
export const sanitizeMoneyText = (raw: string, allowNegative = false): string => {
  const negativo = allowNegative && raw.trim().startsWith("-");
  const signo = negativo ? "-" : "";
  const s = raw.replace(/[^\d.,]/g, "");

  if (s.includes(".")) {
    const sinMiles = s.replace(/,/g, "");
    const [entero, ...resto] = sinMiles.split(".");
    // El punto siempre es decimal según el contrato es-MX. La antigua
    // inferencia de punto-miles multiplicaba por 1,000 capturas con 3 decimales.
    return `${signo}${entero}.${resto.join("").slice(0, 2)}`;
  }

  // Sólo las comas con grupos completos de miles son agrupación. Un entero
  // de 4+ dígitos seguido de coma y 3 decimales sigue siendo un monto decimal.
  if (/^\d{1,3}(,\d{3})+$/.test(s)) return `${signo}${s.replace(/,/g, "")}`;

  const ultimaComa = s.lastIndexOf(",");
  if (ultimaComa >= 0) {
    const cola = s.slice(ultimaComa + 1).replace(/,/g, "");
    const cabeza = s.slice(0, ultimaComa).replace(/,/g, "");
    return `${signo}${cabeza}.${cola.slice(0, 2)}`;
  }

  return `${signo}${s}`;
};

/**
 * Al editar el texto formateado, sus comas existentes siguen siendo miles.
 * Sólo el tramo insertado puede aportar una coma decimal nueva.
 */
export const sanitizeMoneyEditText = (
  raw: string, anterior: string, allowNegative = false,
): string => {
  let inicio = 0;
  while (inicio < anterior.length && inicio < raw.length && anterior[inicio] === raw[inicio]) inicio++;
  let final = 0;
  while (
    final < anterior.length - inicio && final < raw.length - inicio
    && anterior[anterior.length - final - 1] === raw[raw.length - final - 1]
  ) final++;
  const antes = raw.slice(0, inicio).replace(/,/g, "");
  const insertado = raw.slice(inicio, raw.length - final);
  const despues = raw.slice(raw.length - final).replace(/,/g, "");
  return sanitizeMoneyText(antes + insertado + despues, allowNegative);
};

export interface MoneyTextSelection {
  value: string;
  start: number;
  end: number;
}

/**
 * Un pegado parcial conserva las agrupaciones del importe anterior. El texto
 * insertado tiene su propia notación; reemplazar toda la selección equivale
 * a capturar un importe nuevo. Sin una selección compatible no se infiere.
 */
export const sanitizeMoneyReplacementText = (
  raw: string, selection?: MoneyTextSelection | null, allowNegative = false,
): string => {
  if (!selection) return sanitizeMoneyText(raw, allowNegative);
  const antes = selection.value.slice(0, selection.start);
  const despues = selection.value.slice(selection.end);
  if (!raw.startsWith(antes) || !raw.endsWith(despues)
    || raw.length < antes.length + despues.length) {
    return sanitizeMoneyText(raw, allowNegative);
  }
  const insertado = sanitizeMoneyText(raw.slice(antes.length, raw.length - despues.length), allowNegative);
  return sanitizeMoneyText(antes.replace(/,/g, "") + insertado + despues.replace(/,/g, ""), allowNegative);
};

/** Formatea una cadena limpia para mostrarla con miles, preservando lo tecleado. */
export const formatMoneyDisplay = (clean: string): string => {
  if (clean === "" || clean === "-") return clean;
  const negativo = clean.startsWith("-");
  const cuerpo = negativo ? clean.slice(1) : clean;
  const [entero, decimal] = cuerpo.split(".");
  const enteroFmt = agruparDigitos(entero) || (decimal === undefined ? "" : "0");
  const decimalFmt = decimal === undefined ? "" : `.${decimal}`;
  return `${negativo ? "-" : ""}${enteroFmt}${decimalFmt}`;
};

/** Convierte la cadena limpia a número; `null` cuando está vacía o incompleta. */
export const parseMoneyText = (clean: string): number | null => {
  if (clean === "" || clean === "." || clean === "-" || clean === "-.") return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
};

/** Normaliza al salir del campo: `1234.5` → `1,234.50`; vacío se conserva vacío. */
export const normalizeMoneyText = (clean: string): string => {
  const n = parseMoneyText(clean);
  if (n === null) return "";
  return formatNumber(n, { decimals: 2 });
};

/** Cuenta caracteres significativos (dígitos y punto) antes de una posición. */
export const contarSignificativos = (texto: string, hasta: number): number => {
  let n = 0;
  for (let i = 0; i < Math.min(hasta, texto.length); i++) {
    if (/[\d.]/.test(texto[i])) n++;
  }
  return n;
};

/** Posición de cursor en el texto formateado tras N caracteres significativos. */
export const posicionCursor = (formateado: string, significativos: number): number => {
  if (significativos <= 0) return formateado.startsWith("-") ? 1 : 0;
  let n = 0;
  for (let i = 0; i < formateado.length; i++) {
    if (/[\d.]/.test(formateado[i])) {
      n++;
      if (n === significativos) return i + 1;
    }
  }
  return formateado.length;
};

/** Texto inicial mostrado para un valor numérico del formulario. */
export const valorANumeroTexto = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  // EC-11: `0` es un valor capturado legítimo — se muestra "0" para
  // distinguirlo de "sin capturar" (null/undefined → "").
  if (value === 0) return "0";
  return formatMoneyDisplay(String(value));
};
