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
  // Defensivo: si viene un timestamp (`YYYY-MM-DDTHH:MM:SS...` o con zona),
  // recortar al head fecha; si no parece fecha ISO, devolver "".
  const head = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return "";
  const [y, m, d] = head.split("-");
  return `${d}/${m}/${y}`;
}

export function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const head = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return undefined;
  const [y, m, d] = head.split("-").map(Number);
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

/**
 * Máscara tolerante para captura con teclado: respeta los separadores que el
 * usuario teclea (`/`, `-`, `.`) y completa día/mes con cero a la izquierda en
 * cuanto el segmento se cierra con un separador.
 *
 *  - `1/3/2026`  → `01/03/2026`
 *  - `1/`        → `01/`
 *  - `01/1`      → `01/1` (aún puede volverse `01/12`)
 *  - `01032026`  → `01/03/2026` (captura corrida, delega en `applyMask`)
 *  - `13/032`    → `13/03/2` (el dígito excedente pasa al siguiente segmento)
 *
 * `pad = false` desactiva el cero a la izquierda: se usa cuando el cursor está
 * a media captura y agregar dígitos desplazaría el caret (v13.823.290).
 */
export function applyMaskTyping(raw: string, pad = true): string {
  const limpio = raw.replace(/[^\d/.-]/g, "");
  if (!/[/.-]/.test(limpio)) return applyMask(limpio);
  const trailing = /[/.-]$/.test(limpio);
  const partes = limpio.split(/[/.-]+/).slice(0, 3);
  while (partes.length > 1 && partes[partes.length - 1] === "") partes.pop();

  // Los dígitos que ya no caben en un segmento pasan al siguiente: así se
  // puede teclear corrido aunque la máscara ya haya insertado el separador.
  const capacidad = [2, 2, 4];
  const crudos: string[] = [];
  let excedente = "";
  for (let i = 0; i < 3; i += 1) {
    const seg = partes[i] ?? "";
    if (!seg && !excedente) break;
    const bruto = seg || excedente;
    excedente = seg ? bruto.slice(capacidad[i]) : "";
    crudos.push(bruto.slice(0, capacidad[i]));
  }

  const cerradas = Math.max(
    trailing ? partes.length : partes.length - 1,
    crudos.length - 1,
  );
  const out = crudos.map((v, i) => (
    pad && i < 2 && i < cerradas ? v.padStart(2, "0") : v
  ));
  const res = out.join("/") + (trailing && out.length < 3 ? "/" : "");
  return res.slice(0, 10);
}


/**
 * Posición del caret dentro del texto enmascarado para conservar el mismo
 * número de dígitos a la izquierda del cursor.
 */
export function caretTrasMascara(masked: string, digitosAntes: number): number {
  if (digitosAntes <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < masked.length; i += 1) {
    if (masked[i] >= "0" && masked[i] <= "9") {
      vistos += 1;
      if (vistos === digitosAntes) return i + 1;
    }
  }
  return masked.length;
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

/** Quita hora/zona y el texto sobrante alrededor de la fecha pegada. */
function limpiarRuido(s: string): string {
  return s
    .replace(/[t\s]\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*(z|[ap]\.?\s?m\.?|[+-]\d{2}:?\d{2})?$/i, "")
    .replace(/^\D+/, "")
    .replace(/\D+$/, "")
    .trim();
}

/** Año de dos dígitos → siglo con pivote 70 (`26` → 2026, `98` → 1998). */
function anioPleno(n: number): number {
  if (n >= 100) return n;
  return n < 70 ? 2000 + n : 1900 + n;
}

/** Fallback: sólo dígitos (`13032026` = DDMMYYYY, `20260313` = YYYYMMDD, `130326`). */
function porDigitos(s: string): string | null {
  const d = s.replace(/\D/g, "");
  if (d.length === 8) {
    return buildIso(Number(d.slice(4)), Number(d.slice(2, 4)), Number(d.slice(0, 2)))
      ?? buildIso(Number(d.slice(0, 4)), Number(d.slice(4, 6)), Number(d.slice(6, 8)));
  }
  if (d.length === 6) {
    return buildIso(anioPleno(Number(d.slice(4))), Number(d.slice(2, 4)), Number(d.slice(0, 2)));
  }
  return null;
}

/**
 * Parseo tolerante para valores pegados desde otras fuentes. Acepta:
 *  - `DD/MM/YYYY`, `D/M/YYYY`, `D/M/YY` con separadores `/`, `-` o `.`
 *  - `YYYY-MM-DD` / `YYYY/MM/DD` (ISO), con o sin hora (`2026-03-13T10:00`)
 *  - `DD [de] MMM[M...] [de] YYYY` en español (enero…diciembre / ene…dic)
 *  - Texto con ruido alrededor (`Vence: 13/03/2026 (viernes)`)
 *  - Sólo dígitos (`13032026`, `20260313`, `130326`)
 * Devuelve ISO `YYYY-MM-DD` o `null` si no logra reconocer un valor válido.
 */
export function parseFlexible(raw: string): string | null {
  if (!raw) return null;
  const s = limpiarRuido(raw.trim().toLowerCase());
  if (!s) return null;

  // ISO YYYY-MM-DD o YYYY/MM/DD
  const iso = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (iso) return buildIso(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // DD[/-.]MM[/-.]YY(YY)
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) return buildIso(anioPleno(Number(dmy[3])), Number(dmy[2]), Number(dmy[1]));

  // DD [de] MES [de] YYYY (español)
  const es = s.match(/^(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\.?\s+(?:de\s+)?(\d{4})$/i);
  if (es) {
    const mesTxt = es[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const idxFull = MESES_ES.indexOf(mesTxt);
    const idxAbrev = MESES_ES_ABREV.indexOf(mesTxt.slice(0, 3));
    const idx = idxFull >= 0 ? idxFull : idxAbrev;
    if (idx >= 0) return buildIso(Number(es[3]), idx + 1, Number(es[1]));
  }

  return porDigitos(s);
}

