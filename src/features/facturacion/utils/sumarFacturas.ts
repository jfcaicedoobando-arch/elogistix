/**
 * Suma facturas por moneda para el footer totalizador de la tabla de Emitidas.
 * Excluye facturas canceladas para alinearse con el KPI "Facturado mes" del header.
 */
export interface FacturaSumable {
  total: number | string;
  moneda: string;
  estado: string;
}

export interface ResumenFacturasPorMoneda {
  conteo: number;
  totalMxn: number;
  totalUsd: number;
  conteoCanceladas: number;
}

export function sumarFacturasPorMoneda(facturas: FacturaSumable[]): ResumenFacturasPorMoneda {
  let totalMxn = 0;
  let totalUsd = 0;
  let conteo = 0;
  let conteoCanceladas = 0;
  for (const f of facturas) {
    if (f.estado === "Cancelada") {
      conteoCanceladas += 1;
      continue;
    }
    const monto = Number(f.total) || 0;
    if (f.moneda === "USD") totalUsd += monto;
    else if (f.moneda === "MXN") totalMxn += monto;
    conteo += 1;
  }
  return { conteo, totalMxn, totalUsd, conteoCanceladas };
}
