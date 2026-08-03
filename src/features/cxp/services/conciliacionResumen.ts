/**
 * Resumen (lógica pura) del reporte de conciliación automática de tesorería.
 * v13.396.0
 */
import type { ReporteConciliacion } from "./conciliacionTesoreria";

export interface ResumenConciliacion {
  /** Saldo pendiente recalculado, por moneda. */
  saldoPorMoneda: Array<{ moneda: string; saldo: number; facturasAbiertas: number }>;
  sinMovimiento: number;
  descuadres: number;
  /** `true` cuando no hay ninguna incidencia por revisar. */
  cuadrado: boolean;
  /** Frase corta para mostrar al usuario. */
  mensaje: string;
}

export function resumenConciliacion(r: ReporteConciliacion | null): ResumenConciliacion {
  if (!r) {
    return {
      saldoPorMoneda: [], sinMovimiento: 0, descuadres: 0, cuadrado: true,
      mensaje: "Sin conciliar todavía",
    };
  }
  const sinMovimiento = r.incidencias.filter((i) => i.tipo === "sin_movimiento").length;
  const descuadres = r.incidencias.filter((i) => i.tipo === "descuadre").length;
  const cuadrado = sinMovimiento === 0 && descuadres === 0;

  const mapa = new Map<string, { saldo: number; facturasAbiertas: number }>();
  for (const p of r.proveedores) {
    const prev = mapa.get(p.moneda) ?? { saldo: 0, facturasAbiertas: 0 };
    mapa.set(p.moneda, {
      saldo: prev.saldo + p.saldoPendiente,
      facturasAbiertas: prev.facturasAbiertas + p.facturasAbiertas,
    });
  }
  const saldoPorMoneda = [...mapa.entries()]
    .map(([moneda, v]) => ({ moneda, ...v }))
    .sort((a, b) => a.moneda.localeCompare(b.moneda, "es-MX"));

  return { saldoPorMoneda, sinMovimiento, descuadres, cuadrado, mensaje: mensajeConciliacion(r) };
}

function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}

/** Frase de resultado en lenguaje de negocio. */
export function mensajeConciliacion(r: ReporteConciliacion): string {
  const sinMovimiento = r.incidencias.filter((i) => i.tipo === "sin_movimiento").length;
  const descuadres = r.incidencias.filter((i) => i.tipo === "descuadre").length;
  const partes: string[] = [];
  if (r.facturasActualizadas > 0) {
    partes.push(`se corrigió el estatus de ${plural(r.facturasActualizadas, "factura", "facturas")}`);
  }
  if (sinMovimiento > 0) {
    partes.push(`${plural(sinMovimiento, "pago", "pagos")} sin movimiento de tesorería`);
  }
  if (descuadres > 0) {
    partes.push(`${plural(descuadres, "pago", "pagos")} con importe distinto al banco`);
  }
  if (partes.length === 0) {
    return `Todo cuadra: ${plural(r.facturasRevisadas, "factura revisada", "facturas revisadas")}.`;
  }
  return `Conciliación: ${partes.join("; ")}.`;
}
