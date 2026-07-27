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
import { isoUtcDay } from "@/lib/date/mx";
import Papa from "papaparse";
import { logger } from "@/lib/observability/logger";


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
  if (raw instanceof Date) return isoUtcDay(raw);
  if (typeof raw === "number") {
    // Excel serial
    const ms = (raw - 25569) * 86_400_000;
    return isoUtcDay(new Date(ms));
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

/**
 * Convierte el valor crudo en número conservando el signo (los cargos suelen
 * llegar negativos en el estado de cuenta). Devuelve `NaN` cuando el valor no
 * es parseable para que la fila se descarte con evidencia y no se colapse
 * silenciosamente a 0.
 */
function parseMonto(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") return raw;
  const s = String(raw).replace(/[$,\s]/g, "");
  // paréntesis contables denotan cargo negativo: (1,234.56) → -1234.56
  const isParen = /^\(.*\)$/.test(s);
  const clean = s.replace(/[()]/g, "");
  const n = Number(clean);
  if (!Number.isFinite(n)) return NaN;
  return isParen ? -Math.abs(n) : n;
}


async function sha1(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const ups = rows[i].map((c) => norm(String(c ?? "")));
    const hasFecha = ups.some((c) => HEADERS_FECHA.includes(c));
    const hasConcepto = ups.some((c) => HEADERS_CONCEPTO.includes(c));
    const hasMonto = ups.some((c) => HEADERS_CARGO.includes(c)) || ups.some((c) => HEADERS_ABONO.includes(c));
    if (hasFecha && hasConcepto && hasMonto) return i;
  }
  return -1;
}

interface ColIdx { fecha: number; conc: number; ref: number; cargo: number; abono: number; saldo: number }

function parseMontosRow(row: unknown[], idx: ColIdx):
  | { cargo: number; abono: number; saldo: number | null }
  | null {
  const cargoRaw = idx.cargo >= 0 ? parseMonto(row[idx.cargo]) : 0;
  const abonoRaw = idx.abono >= 0 ? parseMonto(row[idx.abono]) : 0;
  if (Number.isNaN(cargoRaw) || Number.isNaN(abonoRaw)) {
    logger.warn("bbva", "fila descartada: monto no parseable", { row });
    return null;
  }
  const saldoRaw = idx.saldo >= 0 ? row[idx.saldo] : null;
  const saldoNum = saldoRaw == null || saldoRaw === "" ? null : parseMonto(saldoRaw);
  const saldo = saldoNum == null || Number.isNaN(saldoNum) ? null : saldoNum;
  return { cargo: cargoRaw, abono: abonoRaw, saldo };
}

async function rowToMovimiento(row: unknown[], idx: ColIdx): Promise<MovimientoParseado | null> {
  if (!row || row.every((c) => c == null || String(c).trim() === "")) return null;
  const fecha = parseFecha(row[idx.fecha]);
  if (!fecha) return null;
  const concepto = String(row[idx.conc] ?? "").trim();
  const referencia = idx.ref >= 0 ? String(row[idx.ref] ?? "").trim() : "";
  const montos = parseMontosRow(row, idx);
  if (!montos) return null;
  const { cargo, abono, saldo } = montos;
  if (cargo === 0 && abono === 0) return null;
  const hash = await sha1([fecha, concepto, referencia, cargo, abono].join("|"));
  return { fecha, concepto, referencia, cargo, abono, saldo, hash_dedupe: hash };
}



async function filasAMovimientos(rows: string[][]): Promise<MovimientoParseado[]> {
  const headerIdx = findHeaderRow(rows);
  if (headerIdx < 0) {
    throw new Error("No se encontraron encabezados FECHA / DESCRIPCION / CARGO en el archivo BBVA.");
  }
  const headers = rows[headerIdx].map((c) => String(c ?? ""));
  const idx: ColIdx = {
    fecha: findColIdx(headers, HEADERS_FECHA),
    conc: findColIdx(headers, HEADERS_CONCEPTO),
    ref: findColIdx(headers, HEADERS_REF),
    cargo: findColIdx(headers, HEADERS_CARGO),
    abono: findColIdx(headers, HEADERS_ABONO),
    saldo: findColIdx(headers, HEADERS_SALDO),
  };

  const movimientos: MovimientoParseado[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const m = await rowToMovimiento(rows[r], idx);
    if (m) movimientos.push(m);
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
  // Dynamic import: xlsx (~400 KB) sólo se carga al importar un .xlsx real,
  // evitando arrastrar la lib en el bundle inicial de Tesorería.
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // SAFE-CAST: XLSX retorna unknown[][]; sólo lo usamos como strings en filasAMovimientos.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true }) as unknown as string[][];
  return filasAMovimientos(rows);
}

