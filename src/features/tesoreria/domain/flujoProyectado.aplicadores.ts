/**
 * Aplicadores puros de flujo proyectado (extraído de `flujoProyectado.ts`).
 */
import { formatDateOnlyLocal } from "@/lib/date/dateOnly";
import { aMxn } from "@/lib/financial/convertir";
import type { CobranzaRow, CxpRow, LiquidacionRow } from "./resumen";
import type { SemanaFlujo } from "./flujoProyectado";

/** Acumulador de exclusiones (montos no convertibles) por moneda. */
export class Exclusiones {
  incompleto = false;
  porMoneda: Record<string, number> = {};

  registrar(monto: number, moneda: string): void {
    this.incompleto = true;
    const m = (moneda ?? "MXN").toUpperCase();
    this.porMoneda[m] = (this.porMoneda[m] ?? 0) + monto;
  }
}

export type InWindow = (iso: string | null) => SemanaFlujo | null;

export function aplicarCobranza(rows: CobranzaRow[], inWindow: InWindow, exclusiones: Exclusiones): void {
  for (const f of rows) {
    if (f.saldo <= 0) continue;
    const sem = inWindow(f.fecha_vencimiento); if (!sem) continue;
    const conv = aMxn(f.saldo, f.moneda, f.tipo_cambio);
    if (!conv.completo) { exclusiones.registrar(f.saldo, f.moneda); continue; }
    sem.entradas_mxn += conv.monto;
    sem.detalle_entradas.push({
      id: f.id, concepto: `${f.numero} · ${f.cliente_nombre}`,
      monto_mxn: conv.monto, fecha_vencimiento: f.fecha_vencimiento!, moneda: f.moneda,
    });
  }
}

export function aplicarCxp(rows: CxpRow[], inWindow: InWindow, exclusiones: Exclusiones): void {
  for (const c of rows) {
    // v13.315.7 (QW1) — fecha efectiva = programada > vencimiento.
    const fechaEfectiva = c.fecha_programada_pago ?? c.fecha_vencimiento;
    if (c.saldo <= 0 || !fechaEfectiva) continue;
    const sem = inWindow(fechaEfectiva); if (!sem) continue;
    const conv = aMxn(c.saldo, c.moneda, c.tipo_cambio_usd);
    if (!conv.completo) { exclusiones.registrar(c.saldo, c.moneda); continue; }
    sem.salidas_mxn += conv.monto;
    sem.detalle_salidas.push({
      id: c.id, concepto: `${c.folio_proveedor} · ${c.proveedor_nombre}`,
      monto_mxn: conv.monto, fecha_vencimiento: fechaEfectiva, moneda: c.moneda,
    });
  }
}

export function aplicarLiquidaciones(rows: LiquidacionRow[], inWindow: InWindow): void {
  for (const l of rows) {
    const [y, m] = l.periodo.split("-").map(Number);
    if (!y || !m) continue;
    const dueDate = new Date(y, m, 5);
    const iso = formatDateOnlyLocal(dueDate);
    const sem = inWindow(iso); if (!sem) continue;
    sem.salidas_mxn += Number(l.total_mxn);
    sem.detalle_salidas.push({
      id: l.id, concepto: `Liquidación comisión ${l.periodo}`,
      monto_mxn: Number(l.total_mxn), fecha_vencimiento: iso, moneda: "MXN",
    });
  }
}
