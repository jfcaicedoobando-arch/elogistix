/**
 * Tipos y constantes del libro maestro de pagos (Tesorería → Pagos).
 *
 * Extraído de `libroPagos.ts` para respetar el límite de 200 líneas por
 * archivo (Power of 10).
 */

export type TipoPago = "cobro" | "pago" | "anticipo";
export type VistaLibroPagos = "todos" | "recibidos" | "realizados";
export type FiltroConciliacion = "todos" | "conciliados" | "pendientes";
export type FiltroRep = "todos" | "timbrado" | "pendiente" | "cancelado";

export interface PagoLibro {
  id: string;
  tipo: TipoPago;
  fecha: string;
  contraparte: string | null;
  contraparte_id: string | null;
  documento_id: string | null;
  documento_folio: string | null;
  moneda: string;
  monto: number;
  /** MNY-P2.3: `null` = pago legacy sin T/C registrado (no se asume 1). */
  tipo_cambio: number | null;
  /** MNY-P2.3: `null` = equivalente en pesos desconocido. */
  monto_mxn: number | null;
  metodo_pago: string | null;
  referencia: string | null;
  cuenta_bancaria_id: string | null;
  cuenta_alias: string | null;
  cuenta_banco: string | null;
  notas: string | null;
  embarque_id: string | null;
  diferencia_cambiaria_mxn: number;
  estado_rep: string | null;
  folio_rep: string | null;
  es_ajuste: boolean;
  es_anticipo_aplicado: boolean;
  lote_id: string | null;
  conciliado: boolean;
  movimiento_id: string | null;
  created_at: string | null;
}

export interface LibroPagos {
  desde: string;
  hasta: string;
  pagos: PagoLibro[];
}

export interface FiltrosLibroPagos {
  vista: VistaLibroPagos;
  cuentaId: string;
  moneda: string;
  metodo: string;
  conciliacion: FiltroConciliacion;
  rep: FiltroRep;
  texto: string;
}

export const FILTROS_LIBRO_PAGOS_INICIALES: FiltrosLibroPagos = {
  vista: "todos",
  cuentaId: "todas",
  moneda: "todas",
  metodo: "todos",
  conciliacion: "todos",
  rep: "todos",
  texto: "",
};

export const TIPO_PAGO_LABELS: Record<TipoPago, string> = {
  cobro: "Cobro de cliente",
  pago: "Pago a proveedor",
  anticipo: "Anticipo a proveedor",
};

export const VISTA_LABELS: Record<VistaLibroPagos, string> = {
  todos: "Todos",
  recibidos: "Recibidos",
  realizados: "Realizados",
};

export interface TotalesLibroPagos {
  cobradoMxn: number;
  pagadoMxn: number;
  netoMxn: number;
  conteo: number;
  /** MNY-P2.3: pagos sin T/C registrado, excluidos de los totales en pesos. */
  sinTcCount: number;
}
