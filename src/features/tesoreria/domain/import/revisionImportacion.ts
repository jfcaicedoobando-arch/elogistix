import type { MovimientoParseado } from "./bbva";
import { roundMoney } from "@/lib/financial/financialUtils";
import { addDaysIso, diffDiasCalendario } from "@/lib/date/dateOnly";

export interface EspejoImportacion {
  id: string;
  cuenta_bancaria_id: string;
  hash_dedupe: string;
  pago_factura_id: string | null;
  fecha: string;
  cargo: number;
  abono: number;
}
export interface FilaRevisionImportacion {
  movimiento: MovimientoParseado;
  estado: "Nueva" | "Duplicada" | "Vinculable" | "Ambigua";
  espejo: EspejoImportacion | null;
  coincidencias: number;
}
export interface ResumenRevisionImportacion {
  filas: FilaRevisionImportacion[];
  nuevas: number;
  duplicadas: number;
  vinculables: number;
  ambiguas: number;
  cargos: number;
  abonos: number;
  desde: string;
  hasta: string;
}

export function moverDiaImportacion(fecha: string, dias: number): string {
  const movida = addDaysIso(fecha, dias);
  if (!movida) throw new Error("La fecha del movimiento bancario no es válida para revisar el archivo.");
  return movida;
}

/** Simula el consumo secuencial de espejos del canon SQL, sin guardar nada. */
export function clasificarRevisionImportacion(
  movimientos: MovimientoParseado[], hashesExistentes: Set<string>, espejos: EspejoImportacion[],
): ResumenRevisionImportacion {
  const consumidos = new Set<string>();
  const hashesVistos = new Set(hashesExistentes);
  const filas = movimientos.map((movimiento): FilaRevisionImportacion => {
    if (hashesVistos.has(movimiento.hash_dedupe)) return { movimiento, estado: "Duplicada", espejo: null, coincidencias: 0 };
    hashesVistos.add(movimiento.hash_dedupe);
    const matches = espejos.filter((e) => !consumidos.has(e.id) && e.pago_factura_id && e.hash_dedupe.startsWith("cobro-")
      && roundMoney(e.cargo) === roundMoney(movimiento.cargo) && roundMoney(e.abono) === roundMoney(movimiento.abono)
      && Math.abs(diffDiasCalendario(e.fecha, movimiento.fecha)) <= 3);
    if (matches.length === 1) {
      consumidos.add(matches[0].id);
      return { movimiento, estado: "Vinculable", espejo: matches[0], coincidencias: 1 };
    }
    return { movimiento, estado: matches.length > 1 ? "Ambigua" : "Nueva", espejo: null, coincidencias: matches.length };
  });
  const fechas = movimientos.map((m) => m.fecha).sort();
  const contar = (estado: FilaRevisionImportacion["estado"]) => filas.filter((f) => f.estado === estado).length;
  return {
    filas, nuevas: contar("Nueva") + contar("Ambigua"), duplicadas: contar("Duplicada"),
    vinculables: contar("Vinculable"), ambiguas: contar("Ambigua"),
    cargos: roundMoney(movimientos.reduce((sum, m) => sum + m.cargo, 0)),
    abonos: roundMoney(movimientos.reduce((sum, m) => sum + m.abono, 0)),
    desde: fechas[0] ?? "", hasta: fechas.at(-1) ?? "",
  };
}

/** La huella permite detectar cambios del candidato incluso si sigue coincidiendo. */
export function huellaEspejoImportacion(espejo: EspejoImportacion) {
  const { cuenta_bancaria_id, hash_dedupe, pago_factura_id, fecha, cargo, abono } = espejo;
  return { cuenta_bancaria_id, hash_dedupe, pago_factura_id, fecha, cargo, abono };
}

export function firmaRevisionImportacion(revision: ResumenRevisionImportacion): string {
  return JSON.stringify(revision.filas.map((f) => ({ hash: f.movimiento.hash_dedupe, estado: f.estado,
    espejo: f.espejo ? { id: f.espejo.id, ...huellaEspejoImportacion(f.espejo) } : null })));
}
