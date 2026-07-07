/**
 * Helpers puros de conversión/parseo para `DatePickerMx`.
 * Extraídos del componente para respetar el límite Power of 10
 * (≤200 líneas por archivo).
 *
 * Formato visible: DD/MM/YYYY. Valor interno: ISO YYYY-MM-DD.
 */

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2100;

export function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Aplica máscara DD/MM/YYYY a un string de sólo dígitos. */
export function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

/** Parsea DD/MM/YYYY → ISO YYYY-MM-DD, o `null` si es inválido. */
export function parseDisplay(text: string): string | null {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (yyyy < MIN_YEAR || yyyy > MAX_YEAR) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  const date = new Date(yyyy, mm - 1, dd);
  if (
    date.getFullYear() !== yyyy ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) return null;
  return dateToIso(date);
}

/** Meses en español (minúsculas). Índice = mes-1. */
const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_ES_ABREV = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function buildIso(y: number, m: number, d: number): string | null {
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return dateToIso(date);
}

/**
 * Parseo tolerante para valores pegados desde otras fuentes. Acepta:
 *  - `DD/MM/YYYY`, `D/M/YYYY` con separadores `/`, `-` o `.`
 *  - `YYYY-MM-DD` / `YYYY/MM/DD` (ISO)
 *  - `DD [de] MMM[M...] [de] YYYY` en español (enero…diciembre / ene…dic)
 * Devuelve ISO `YYYY-MM-DD` o `null` si no logra reconocer un valor válido.
 */
export function parseFlexible(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  // ISO YYYY-MM-DD o YYYY/MM/DD
  const iso = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (iso) return buildIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // DD[/-.]MM[/-.]YYYY
  const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (dmy) return buildIso(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));

  // DD [de] MES [de] YYYY (español)
  const es = s.match(/^(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\.?\s+(?:de\s+)?(\d{4})$/i);
  if (es) {
    const mesTxt = es[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const idxFull = MESES_ES.indexOf(mesTxt);
    const idxAbrev = MESES_ES_ABREV.indexOf(mesTxt.slice(0, 3));
    const idx = idxFull >= 0 ? idxFull : idxAbrev;
    if (idx >= 0) return buildIso(Number(es[3]), idx + 1, Number(es[1]));
  }

  return null;
}

