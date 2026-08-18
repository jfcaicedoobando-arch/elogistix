/**
 * Repartos del cobro en lote de cliente (CxC): FIFO por vencimiento, liquidar
 * todo y limpiar.
 *
 * Se separó de `pagoClienteLote.ts` para respetar el límite de 200 líneas
 * (Power of 10). Funciones puras: no tocan la base ni el DOM.
 */
import { round2 } from "@/features/cxp/services";
import type { FacturaCobroCandidata, RenglonCobro } from "./pagoClienteLote";

/**
 * Reparte `total` entre las facturas ordenadas por vencimiento (FIFO).
 * Nunca asigna más que el saldo de cada factura; el sobrante no se aplica.
 */
export function repartirFifo(
  facturas: FacturaCobroCandidata[],
  total: number,
): { renglones: RenglonCobro[]; sobrante: number } {
  const orden = [...facturas].sort((a, b) =>
    (a.fecha_vencimiento ?? "9999-12-31").localeCompare(b.fecha_vencimiento ?? "9999-12-31"),
  );
  let restante = round2(total);
  const renglones: RenglonCobro[] = [];

  for (const f of orden) {
    if (restante <= 0) {
      renglones.push({ factura_id: f.factura_id, monto: 0 });
      continue;
    }
    const monto = round2(Math.min(restante, round2(f.saldo)));
    renglones.push({ factura_id: f.factura_id, monto });
    restante = round2(restante - monto);
  }

  return { renglones, sobrante: restante };
}

/** Asigna a cada factura su saldo completo (atajo "Liquidar todo"). */
export function repartirTodo(facturas: FacturaCobroCandidata[]): RenglonCobro[] {
  return facturas.map((f) => ({ factura_id: f.factura_id, monto: round2(f.saldo) }));
}

/** Deja el reparto en ceros (atajo "Limpiar reparto"). */
export function repartirCero(facturas: FacturaCobroCandidata[]): RenglonCobro[] {
  return facturas.map((f) => ({ factura_id: f.factura_id, monto: 0 }));
}
