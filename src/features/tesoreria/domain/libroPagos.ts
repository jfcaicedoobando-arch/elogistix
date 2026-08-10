/**
 * Dominio puro del libro maestro de pagos (Tesorería → Pagos).
 *
 * Reúne cobros de clientes, pagos a proveedores y anticipos en una sola lista.
 * Contiene tipos, filtros en memoria y totales. Sin red ni React.
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
  tipo_cambio: number;
  monto_mxn: number;
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


export function normalizarTextoPago(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** ¿El pago entra dinero (cobro) o lo saca (pago / anticipo)? */
export function esEntrada(pago: PagoLibro): boolean {
  return pago.tipo === "cobro";
}

function coincideVista(pago: PagoLibro, vista: VistaLibroPagos): boolean {
  if (vista === "recibidos") return esEntrada(pago);
  if (vista === "realizados") return !esEntrada(pago);
  return true;
}

function coincideRep(pago: PagoLibro, rep: FiltroRep): boolean {
  if (rep === "todos") return true;
  if (pago.tipo !== "cobro") return false;
  const estado = normalizarTextoPago(pago.estado_rep ?? "");
  if (rep === "timbrado") return estado === "timbrado";
  if (rep === "cancelado") return estado === "cancelado";
  return estado !== "timbrado" && estado !== "cancelado";
}

function coincideCuenta(pago: PagoLibro, f: FiltrosLibroPagos): boolean {
  if (f.cuentaId !== "todas" && pago.cuenta_bancaria_id !== f.cuentaId) return false;
  if (f.moneda !== "todas" && pago.moneda !== f.moneda) return false;
  if (f.metodo !== "todos" && (pago.metodo_pago ?? "") !== f.metodo) return false;
  return true;
}

function coincideConciliacion(pago: PagoLibro, f: FiltrosLibroPagos): boolean {
  if (f.conciliacion === "conciliados") return pago.conciliado;
  if (f.conciliacion === "pendientes") return !pago.conciliado;
  return true;
}

function coincideTexto(pago: PagoLibro, q: string): boolean {
  if (!q) return true;
  const campo = normalizarTextoPago(
    `${pago.contraparte ?? ""} ${pago.documento_folio ?? ""} ${pago.referencia ?? ""} ${pago.notas ?? ""}`,
  );
  return campo.includes(q);
}

/** Filtra los pagos ya traídos del servidor. */
export function filtrarPagos(
  pagos: readonly PagoLibro[],
  f: FiltrosLibroPagos,
): PagoLibro[] {
  const q = normalizarTextoPago(f.texto);
  return pagos.filter(
    (p) =>
      coincideVista(p, f.vista) &&
      coincideCuenta(p, f) &&
      coincideConciliacion(p, f) &&
      coincideRep(p, f.rep) &&
      coincideTexto(p, q),
  );
}

export interface TotalesLibroPagos {
  cobradoMxn: number;
  pagadoMxn: number;
  netoMxn: number;
  conteo: number;
}

/** Totales en MXN de los pagos visibles (para los KPIs y el pie). */
export function totalesLibroPagos(pagos: readonly PagoLibro[]): TotalesLibroPagos {
  let cobradoMxn = 0;
  let pagadoMxn = 0;
  for (const p of pagos) {
    // Ola 4 · N20: los ajustes no mueven dinero y los anticipos aplicados ya se
    // contaron cuando entró el anticipo; sumarlos infla el flujo de caja.
    if (p.es_ajuste || p.es_anticipo_aplicado) continue;
    if (esEntrada(p)) cobradoMxn += p.monto_mxn;
    else pagadoMxn += p.monto_mxn;
  }
  return {
    cobradoMxn,
    pagadoMxn,
    netoMxn: cobradoMxn - pagadoMxn,
    conteo: pagos.length,
  };
}

/** Métodos de pago presentes en los datos, para poblar el filtro. */
export function metodosDisponibles(pagos: readonly PagoLibro[]): string[] {
  const set = new Set<string>();
  for (const p of pagos) {
    if (p.metodo_pago) set.add(p.metodo_pago);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es-MX"));
}

/** Monedas presentes en los datos, para poblar el filtro. */
export function monedasDisponibles(pagos: readonly PagoLibro[]): string[] {
  const set = new Set<string>();
  for (const p of pagos) set.add(p.moneda);
  return [...set].sort((a, b) => a.localeCompare(b, "es-MX"));
}
