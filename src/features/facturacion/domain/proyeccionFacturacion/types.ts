/** Tipos compartidos de proyección de facturación mensual. */

export type EstadoProyeccion = "Facturado" | "Pendiente";

/** Fila plana traída del backend para un embarque del mes seleccionado. */
export interface FilaProyeccion {
  embarque_id: string;
  expediente: string;
  cliente_nombre: string;
  operador: string;
  eta: string | null;
  contenedor: string | null;
  tipo_cambio_usd: number;
  tipo_cambio_eur: number;
  /** Ola 5 · M5: el embarque no tiene tipo de cambio USD capturado. */
  sin_tc: boolean;
  tiene_proforma: boolean;
  /** ¿Existe al menos una factura con factura_pdf_url para este embarque? */
  tiene_factura_pdf: boolean;
  venta_mxn: number;
  venta_usd: number;
  costo_mxn: number;
  costo_usd: number;
}

/** Grupo consolidado por expediente. */
export interface GrupoProyeccion {
  expediente: string;
  cliente_nombre: string;
  operador: string;
  /** ETA representativa (mínima del grupo). */
  eta: string | null;
  contenedores: string[];
  totalContenedores: number;
  ventaMxn: number;
  ventaUsd: number;
  costoMxn: number;
  costoUsd: number;
  profitMxn: number;
  profitUsd: number;
  margenPct: number;
  estado: EstadoProyeccion;
  /** Embarques que componen el grupo (para drilldown). */
  embarqueIds: string[];
}

export interface KpisProyeccion {
  totalExpedientes: number;
  facturados: number;
  pendientes: number;
  ventaProyMxn: number;
  ventaFacturadaMxn: number;
  ventaPendienteMxn: number;
  costoTotalMxn: number;
  profitProyMxn: number;
  profitFacturadoMxn: number;
  ventaProyUsd: number;
  ventaFacturadaUsd: number;
  ventaPendienteUsd: number;
  costoTotalUsd: number;
  profitProyUsd: number;
  margenProyPct: number;
  avancePct: number;
}
