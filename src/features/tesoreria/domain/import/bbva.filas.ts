/**
 * Clasificación fila por fila del estado de cuenta BBVA.
 *
 * Defecto 3 (ronda posterior a v13.823.39): antes una fila con fecha o monto
 * ilegible se descartaba en silencio (sólo `logger.warn`) y el importador
 * reportaba "importado" sobre un archivo incompleto. Analogía: es como
 * fotocopiar 100 hojas, que 3 salgan en blanco y entregar el paquete sin
 * avisar. Ahora cada fila descartada se devuelve clasificada para que la UI
 * decida bloquear o advertir.
 */
import { parseFecha, parseMonto, sha1 } from "./bbva.parsers";

export interface MovimientoParseado {
  fecha: string;             // ISO YYYY-MM-DD
  concepto: string;
  referencia: string;
  cargo: number;
  abono: number;
  saldo: number | null;
  hash_dedupe: string;
}

/** Fila que el parser no pudo interpretar (dato ilegible, no fila de relleno). */
export interface FilaDescartada {
  /** Número de fila en el archivo, 1-indexado. */
  fila: number;
  motivo: string;
  valor: string;
}

export interface ColIdx {
  fecha: number;
  conc: number;
  ref: number;
  cargo: number;
  abono: number;
  saldo: number;
}

export type FilaResultado =
  | { tipo: "ok"; movimiento: MovimientoParseado }
  /** Fila de relleno del PDF/CSV (totalmente vacía). */
  | { tipo: "vacia" }
  /** Fila legible pero sin cargo ni abono (subtotales, saldos informativos). */
  | { tipo: "sin_importe" }
  /** Fila con datos ilegibles: NO debe importarse en silencio. */
  | { tipo: "ilegible"; descarte: FilaDescartada };

function parseMontosRow(row: unknown[], idx: ColIdx):
  | { cargo: number; abono: number; saldo: number | null }
  | null {
  const cargoRaw = idx.cargo >= 0 ? parseMonto(row[idx.cargo]) : 0;
  const abonoRaw = idx.abono >= 0 ? parseMonto(row[idx.abono]) : 0;
  if (Number.isNaN(cargoRaw) || Number.isNaN(abonoRaw)) return null;
  const saldoRaw = idx.saldo >= 0 ? row[idx.saldo] : null;
  const saldoNum = saldoRaw == null || saldoRaw === "" ? null : parseMonto(saldoRaw);
  const saldo = saldoNum == null || Number.isNaN(saldoNum) ? null : saldoNum;
  return { cargo: cargoRaw, abono: abonoRaw, saldo };
}

export async function clasificarFila(
  row: unknown[],
  idx: ColIdx,
  numFila: number,
): Promise<FilaResultado> {
  if (!row || row.every((c) => c == null || String(c).trim() === "")) {
    return { tipo: "vacia" };
  }
  const fecha = parseFecha(row[idx.fecha]);
  if (!fecha) {
    return {
      tipo: "ilegible",
      descarte: {
        fila: numFila,
        motivo: "fecha inválida o ilegible",
        valor: String(row[idx.fecha] ?? ""),
      },
    };
  }
  const concepto = String(row[idx.conc] ?? "").trim();
  const referencia = idx.ref >= 0 ? String(row[idx.ref] ?? "").trim() : "";
  const montos = parseMontosRow(row, idx);
  if (!montos) {
    return {
      tipo: "ilegible",
      descarte: {
        fila: numFila,
        motivo: "importe no numérico",
        valor: [row[idx.cargo], row[idx.abono]]
          .map((v) => String(v ?? ""))
          .join(" / "),
      },
    };
  }
  const { cargo, abono, saldo } = montos;
  if (cargo === 0 && abono === 0) return { tipo: "sin_importe" };
  const hash = await sha1([fecha, concepto, referencia, cargo, abono].join("|"));
  return {
    tipo: "ok",
    movimiento: { fecha, concepto, referencia, cargo, abono, saldo, hash_dedupe: hash },
  };
}
