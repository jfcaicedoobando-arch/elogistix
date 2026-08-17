/**
 * Helpers puros de captura de dinero (es-MX).
 *
 * Separados de `MoneyInput` para poder testearlos aislados y reutilizarlos.
 * Convenciones: punto decimal, coma como separador de miles, máximo 2 decimales.
 */

const groupFormatter = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const displayFormatter = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Agrupa en miles una cadena de dígitos ("1234567" → "1,234,567"). */
const agruparDigitos = (digitos: string): string => {
  const limpio = digitos.replace(/^0+(?=\d)/, "");
  if (limpio === "") return "";
  return groupFormatter.format(Number(limpio));
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

  const conDecimal = (entero: string, decimal: string): string =>
    `${signo}${entero}${decimal === "" ? "" : `.${decimal.slice(0, 2)}`}`;

  if (s.includes(".")) {
    const sinMiles = s.replace(/,/g, "");
    const [entero, ...resto] = sinMiles.split(".");
    // EC-06: heurística simétrica a la de la coma — en es-MX es común pegar
    // montos con punto de miles ("50.000" = 50,000). Un único "." seguido de
    // exactamente 3 dígitos y sin otra marca decimal se trata como separador
    // de miles; de otro modo sigue siendo punto decimal.
    if (resto.length === 1 && resto[0].length === 3 && !s.includes(",") && entero !== "") {
      return `${signo}${entero}${resto[0]}`;
    }
    return `${signo}${entero}.${resto.join("").slice(0, 2)}`;
  }

  const ultimaComa = s.lastIndexOf(",");
  if (ultimaComa >= 0) {
    const cola = s.slice(ultimaComa + 1).replace(/,/g, "");
    const cabeza = s.slice(0, ultimaComa).replace(/,/g, "");
    // Coma seguida de ≤2 dígitos = decimal; si trae más, era separador de miles.
    if (cola.length <= 2) return `${signo}${cabeza}${s.endsWith(",") ? "." : `.${cola}`}`;
    return conDecimal(cabeza + cola, "");
  }

  return `${signo}${s}`;
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
  return displayFormatter.format(n);
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
