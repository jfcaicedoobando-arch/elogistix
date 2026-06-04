/**
 * Parser del estado de cuenta BBVA México (Bancomer / Net Cash).
 *
 * Acepta `.xlsx` y `.csv`. Detecta el header automáticamente buscando
 * cabeceras típicas en español: FECHA, DESCRIPCION/CONCEPTO, REFERENCIA,
 * CARGO/RETIRO, ABONO/DEPOSITO, SALDO.
 *
 * Normaliza:
 *  - Fechas en DD/MM/YYYY (con o sin separador) o DD-MMM-YYYY → ISO YYYY-MM-DD.
 *  - Montos con comas / signos / paréntesis → number positivo.
 *  - Calcula `hash_dedupe = sha1(fecha|concepto|referencia|cargo|abono)` para
 *    evitar duplicados al re-importar el mismo periodo.
 */
import * as XLSX from "xlsx";
import Papa from "papaparse";

export interface MovimientoParseado {
  fecha: string;             // ISO YYYY-MM-DD
  concepto: string;
  referencia: string;
  cargo: number;
  abono: number;
  saldo: number | null;
  hash_dedupe: string;
}

const HEADERS_FECHA = ["FECHA", "FECHA OPER", "FECHA OPERACION", "F. OPER"];
const HEADERS_CONCEPTO = ["DESCRIPCION", "DESCRIPCIÓN", "CONCEPTO", "MOVIMIENTO"];
const HEADERS_REF = ["REFERENCIA", "REF", "FOLIO"];
const HEADERS_CARGO = ["CARGO", "RETIRO", "RETIROS", "CARGOS", "DEBE"];
const HEADERS_ABONO = ["ABONO", "DEPOSITO", "DEPÓSITO", "DEPOSITOS", "ABONOS", "HABER"];
const HEADERS_SALDO = ["SALDO", "SALDO OPERACION"];

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");

function findColIdx(headers: string[], candidates: string[]): number {
  const ups = headers.map(norm);
  for (const c of candidates) {
    const i = ups.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

function parseFecha(raw: unknown): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number") {
    // Excel serial
    const ms = (raw - 25569) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (!s) return null;
  const m1 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // DD-MMM-YYYY (e.g. 15-MAY-2026)
  const meses: Record<string, string> = {
    ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06",
    JUL: "07", AGO: "08", SEP: "09", OCT: "10", NOV: "11", DIC: "12",
  };
  const m2 = s.match(/^(\d{1,2})[/-]?([A-Za-z]{3})[/-]?(\d{2,4})$/);
  if (m2) {
    const [, d, monStr, y] = m2;
    const mo = meses[norm(monStr).slice(0, 3)];
    if (!mo) return null;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${mo}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseMonto(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") return Math.abs(raw);
  const s = String(raw).replace(/[$,\s]/g, "").replace(/[()]/g, "");
  const n = Number(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

async function sha1(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function filasAMovimientos(rows: string[][]): Promise<MovimientoParseado[]> {
  // Buscar primera fila con encabezados conocidos
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const ups = rows[i].map((c) => norm(String(c ?? "")));
    if (ups.some((c) => HEADERS_FECHA.includes(c)) &&
        ups.some((c) => HEADERS_CONCEPTO.includes(c)) &&
        (ups.some((c) => HEADERS_CARGO.includes(c)) || ups.some((c) => HEADERS_ABONO.includes(c)))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    throw new Error("No se encontraron encabezados FECHA / DESCRIPCION / CARGO en el archivo BBVA.");
  }
  const headers = rows[headerIdx].map((c) => String(c ?? ""));
  const iFecha = findColIdx(headers, HEADERS_FECHA);
  const iConc = findColIdx(headers, HEADERS_CONCEPTO);
  const iRef = findColIdx(headers, HEADERS_REF);
  const iCargo = findColIdx(headers, HEADERS_CARGO);
  const iAbono = findColIdx(headers, HEADERS_ABONO);
  const iSaldo = findColIdx(headers, HEADERS_SALDO);

  const movimientos: MovimientoParseado[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    const fecha = parseFecha(row[iFecha]);
    if (!fecha) continue;
    const concepto = String(row[iConc] ?? "").trim();
    const referencia = iRef >= 0 ? String(row[iRef] ?? "").trim() : "";
    const cargo = iCargo >= 0 ? parseMonto(row[iCargo]) : 0;
    const abono = iAbono >= 0 ? parseMonto(row[iAbono]) : 0;
    const saldoRaw = iSaldo >= 0 ? row[iSaldo] : null;
    const saldo = saldoRaw == null || saldoRaw === "" ? null : parseMonto(saldoRaw);
    if (cargo === 0 && abono === 0) continue;
    const hash = await sha1([fecha, concepto, referencia, cargo, abono].join("|"));
    movimientos.push({ fecha, concepto, referencia, cargo, abono, saldo, hash_dedupe: hash });
  }
  return movimientos;
}

export async function parseEstadoCuentaBBVA(file: File): Promise<MovimientoParseado[]> {
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
  if (isCsv) {
    const text = await file.text();
    const { data } = Papa.parse<string[]>(text, { skipEmptyLines: true });
    return filasAMovimientos(data);
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // SAFE-CAST: XLSX retorna unknown[][]; sólo lo usamos como strings en filasAMovimientos.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true }) as unknown as string[][];
  return filasAMovimientos(rows);
}
