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
 *    evitar duplicados al re-importar el mismo periodo. N32 (Ola 4): la 2ª+
 *    ocurrencia del mismo hash DENTRO del archivo recibe sufijo ordinal
 *    determinista, para no colapsar movimientos reales idénticos.
 */
import {
  HEADERS_ABONO,
  HEADERS_CARGO,
  HEADERS_CONCEPTO,
  HEADERS_FECHA,
  HEADERS_REF,
  HEADERS_SALDO,
  findColIdx,
  norm,
  parseFecha,
  parseMonto,
  sha1,
} from "./bbva.parsers";
import { leerArchivoTexto } from "@/lib/io/readFileText";
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

/**
 * N33 (Ola 4): heurística anti-MM/DD. En un archivo DD/MM real el segundo
 * componente (mes) nunca pasa de 12; si la mayoría de las filas lo supera,
 * el archivo casi seguro viene en MM/DD y seguir importaría fechas cambiadas
 * silenciosamente en todas las filas con día ≤12.
 */
function detectarFormatoMmDd(rows: string[][], colFecha: number, desdeFila: number): boolean {
  let total = 0;
  let sospechosas = 0;
  for (let r = desdeFila; r < rows.length; r++) {
    const raw = rows[r]?.[colFecha];
    if (typeof raw !== "string") continue;
    const m = raw.trim().match(/^\d{1,2}[/-](\d{1,2})[/-]\d{2,4}$/);
    if (!m) continue;
    total++;
    if (Number(m[1]) > 12) sospechosas++;
  }
  return total > 0 && sospechosas > total / 2;
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

async function rowToMovimiento(
  row: unknown[],
  idx: ColIdx,
  numFila?: number,
): Promise<MovimientoParseado | null> {
  if (!row || row.every((c) => c == null || String(c).trim() === "")) return null;
  const fecha = parseFecha(row[idx.fecha]);
  if (!fecha) {
    // N33 (Ola 4): antes se descartaba en silencio y sin identificar la fila.
    logger.warn("bbva", "fila descartada: fecha inválida o ilegible", {
      fila: numFila,
      valor: String(row[idx.fecha] ?? ""),
    });
    return null;
  }
  const concepto = String(row[idx.conc] ?? "").trim();
  const referencia = idx.ref >= 0 ? String(row[idx.ref] ?? "").trim() : "";
  const montos = parseMontosRow(row, idx);
  if (!montos) return null;
  const { cargo, abono, saldo } = montos;
  if (cargo === 0 && abono === 0) return null;
  const hash = await sha1([fecha, concepto, referencia, cargo, abono].join("|"));
  return { fecha, concepto, referencia, cargo, abono, saldo, hash_dedupe: hash };
}



/**
 * N32 (Ola 4): dos movimientos reales idénticos el mismo día (comisión + IVA,
 * dos nóminas del mismo importe con referencia vacía) generaban el mismo
 * hash_dedupe y el upsert descartaba el segundo silenciosamente.
 *
 * Sin tocar el hash base (cambiarlo re-importaría TODOS los históricos como
 * nuevos), la 2ª/3ª… ocurrencia dentro del MISMO archivo recibe un sufijo
 * ordinal determinista: mismo archivo → mismos hashes → la re-importación
 * sigue siendo idempotente.
 */
async function desambiguarColisiones(
  movimientos: MovimientoParseado[],
): Promise<MovimientoParseado[]> {
  const vistos = new Map<string, number>();
  let colisiones = 0;
  for (const m of movimientos) {
    const n = vistos.get(m.hash_dedupe) ?? 0;
    vistos.set(m.hash_dedupe, n + 1);
    if (n === 0) continue;
    colisiones++;
    m.hash_dedupe = await sha1(`${m.hash_dedupe}|fila-${n + 1}`);
  }
  if (colisiones > 0) {
    logger.warn("bbva", "movimientos idénticos en el mismo archivo: se conservan con hash ordinal", { colisiones });
  }
  return movimientos;
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

  if (idx.fecha >= 0 && detectarFormatoMmDd(rows, idx.fecha, headerIdx + 1)) {
    throw new Error(
      "El archivo parece usar formato MM/DD/AAAA (mes primero). El importador espera DD/MM/AAAA; convierte las fechas antes de importar para evitar movimientos con fecha cambiada.",
    );
  }
  const movimientos: MovimientoParseado[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const m = await rowToMovimiento(rows[r], idx, r + 1);
    if (m) movimientos.push(m);
  }
  return desambiguarColisiones(movimientos);
}

export async function parseEstadoCuentaBBVA(file: File): Promise<MovimientoParseado[]> {
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
  if (isCsv) {
    // N34 (Ola 4): tolera Windows-1252 (estados de cuenta Net Cash en es-MX).
    const text = (await leerArchivoTexto(file)).replace(/^\uFEFF/, "");
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

