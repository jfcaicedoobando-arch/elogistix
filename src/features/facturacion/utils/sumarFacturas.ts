/**
 * Suma facturas por moneda para el footer totalizador de la tabla de Emitidas.
 * Excluye facturas canceladas y borradores para alinearse con el KPI
 * "Facturado mes" del header (ver `services/dashboardEjecutivo.ts`).
 *
 * v13.135.72: agrega `mxnEquivalente` y `facturasSinTc` para poder comparar
 * directamente contra el KPI "Facturado mes" del header, que también está en MXN.
 * v13.301.18: también excluye borradores (aún no timbrados).
 */
export interface FacturaSumable {
  total: number | string;
  moneda: string;
  estado: string;
  tipo_cambio?: number | string | null;
}

export interface ResumenFacturasPorMoneda {
  conteo: number;
  totalMxn: number;
  totalUsd: number;
  conteoCanceladas: number;
  /** Suma en MXN equivalente: MXN directo + USD × tipo_cambio (de la factura o fallback). */
  mxnEquivalente: number;
  /** Facturas USD que no tienen tipo_cambio ni hubo fallback disponible (excluidas del MXN equivalente). */
  facturasSinTc: number;
}

export interface SumarOpts {
  /** Tipo de cambio USD→MXN a usar cuando la factura USD no tiene `tipo_cambio`. */
  fallbackUsdMxn?: number | null;
}

/** Estados previos a la emisión: espejo de `etiquetaCicloProforma.ts`. */
const ESTADOS_PREPARACION = new Set(["borrador", "por timbrar"]);

export function sumarFacturasPorMoneda(
  facturas: FacturaSumable[],
  opts: SumarOpts = {},
): ResumenFacturasPorMoneda {
  const fallback = Number(opts.fallbackUsdMxn ?? 0) || 0;
  let totalMxn = 0;
  let totalUsd = 0;
  let mxnEquivalente = 0;
  let conteo = 0;
  let conteoCanceladas = 0;
  let facturasSinTc = 0;

  for (const f of facturas) {
    // FAC-01: estado y moneda se normalizan (trim + minúsculas) para no
    // depender de la capitalización con que venga el dato.
    const estado = (f.estado ?? "").trim().toLowerCase();
    const moneda = (f.moneda ?? "").trim().toUpperCase();
    if (estado === "cancelada") {
      conteoCanceladas += 1;
      continue;
    }
    // FAC-01: Borrador y "Por timbrar" son preparación (aún no timbradas);
    // no son ingreso vigente y no se cuentan ni suman.
    if (ESTADOS_PREPARACION.has(estado)) continue;
    const monto = Number(f.total) || 0;
    if (moneda === "USD") {
      totalUsd += monto;
      const tc = Number(f.tipo_cambio) || 0;
      // tc <= 1 se considera inválido para USD: 1 USD nunca es 1 MXN.
      if (tc > 1) mxnEquivalente += monto * tc;
      else if (fallback > 0) mxnEquivalente += monto * fallback;
      else facturasSinTc += 1;
    } else if (moneda === "MXN") {
      totalMxn += monto;
      mxnEquivalente += monto;
    }

    conteo += 1;
  }
  return { conteo, totalMxn, totalUsd, conteoCanceladas, mxnEquivalente, facturasSinTc };
}
