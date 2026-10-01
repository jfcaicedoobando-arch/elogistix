import { parseDateOnlyLocal, formatDateOnlyLocal } from "@/lib/date/dateOnly";
import type { CobranzaRow, CxpRow, LiquidacionRow } from "./resumen";

interface ResumenVencidos { cantidad: number; por_moneda: Record<string, number> }
export interface VencidosFueraProyeccion {
  anteriores_a: string;
  entradas: ResumenVencidos;
  salidas: ResumenVencidos;
}

/** Expone obligaciones anteriores a la ventana, sin reprogramar ni convertir dinero. */
export function resumirVencidosFueraProyeccion(
  inicio: Date, cobranza: CobranzaRow[], cxp: CxpRow[], liquidaciones: LiquidacionRow[],
): VencidosFueraProyeccion {
  const entradas: ResumenVencidos = { cantidad: 0, por_moneda: {} };
  const salidas: ResumenVencidos = { cantidad: 0, por_moneda: {} };
  const sumar = (destino: ResumenVencidos, fecha: string | null | undefined, saldo: number, moneda: string) => {
    if (!fecha || !Number.isFinite(saldo) || saldo <= 0 || !(parseDateOnlyLocal(fecha) < inicio)) return;
    const m = (moneda || "MXN").toUpperCase();
    destino.cantidad += 1;
    destino.por_moneda[m] = (destino.por_moneda[m] ?? 0) + saldo;
  };
  for (const f of cobranza) sumar(entradas, f.fecha_vencimiento, f.saldo, f.moneda);
  for (const f of cxp) sumar(salidas, f.fecha_programada_pago ?? f.fecha_vencimiento, f.saldo, f.moneda);
  for (const l of liquidaciones) {
    const [y, m] = l.periodo.split("-").map(Number);
    if (!y || !m) continue;
    sumar(salidas, formatDateOnlyLocal(new Date(y, m, 5)), Number(l.total_mxn), "MXN");
  }
  return { anteriores_a: formatDateOnlyLocal(inicio), entradas, salidas };
}
