/**
 * Dominio puro del libro maestro de pagos (Tesorería → Pagos).
 *
 * Reúne cobros de clientes, pagos a proveedores y anticipos en una sola lista.
 * Este archivo conserva los totales y re-exporta tipos y filtros, que viven en
 * `libroPagos.tipos.ts` y `libroPagos.filtros.ts` para respetar el límite de
 * 200 líneas por archivo (Power of 10). Sin red ni React.
 */
import { esEntrada, normalizarTextoPago } from "./libroPagos.filtros";
import type { PagoLibro, TotalesLibroPagos } from "./libroPagos.tipos";

export type {
  TipoPago, VistaLibroPagos, FiltroConciliacion, FiltroRep,
  PagoLibro, LibroPagos, FiltrosLibroPagos, TotalesLibroPagos,
} from "./libroPagos.tipos";
export {
  FILTROS_LIBRO_PAGOS_INICIALES, TIPO_PAGO_LABELS, VISTA_LABELS,
} from "./libroPagos.tipos";
export {
  normalizarTextoPago, esEntrada, filtrarPagos, metodosDisponibles, monedasDisponibles,
} from "./libroPagos.filtros";

/**
 * MNY-07: un cobro con REP cancelado ya no representa dinero cobrado vigente
 * (mismo canon que el saldo/estado de la factura). La fila se conserva en la
 * lista y en el filtro "Cancelado", pero no suma en los KPIs.
 */
export function repCancelado(pago: PagoLibro): boolean {
  return pago.tipo === "cobro" && normalizarTextoPago(pago.estado_rep ?? "") === "cancelado";
}

/** Totales en MXN de los pagos visibles (para los KPIs y el pie). */
export function totalesLibroPagos(pagos: readonly PagoLibro[]): TotalesLibroPagos {
  let cobradoMxn = 0;
  let pagadoMxn = 0;
  let sinTcCount = 0;
  for (const p of pagos) {
    // Ola 4 · N20: los ajustes no mueven dinero y los anticipos aplicados ya se
    // contaron cuando entró el anticipo; sumarlos infla el flujo de caja.
    if (p.es_ajuste || p.es_anticipo_aplicado) continue;
    if (repCancelado(p)) continue;
    // MNY-P2.3: sin T/C registrado no se inventa el equivalente en pesos; la
    // fila se cuenta aparte en vez de sumar un importe falso.
    if (p.monto_mxn == null) {
      sinTcCount += 1;
      continue;
    }
    if (esEntrada(p)) cobradoMxn += p.monto_mxn;
    else pagadoMxn += p.monto_mxn;
  }
  return {
    cobradoMxn,
    pagadoMxn,
    netoMxn: cobradoMxn - pagadoMxn,
    conteo: pagos.length,
    sinTcCount,
  };
}
