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

export interface RangoPagos {
  desde: string;
  hasta: string;
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

function iso(anio: number, mes0: number, dia: number): string {
  return [
    String(anio).padStart(4, "0"),
    String(mes0 + 1).padStart(2, "0"),
    String(dia).padStart(2, "0"),
  ].join("-");
}

function ultimoDiaDelMes(anio: number, mes0: number): number {
  return new Date(anio, mes0 + 1, 0).getDate();
}

/** Mes calendario de `base` (por defecto, hoy). */
export function rangoMesPagos(base: Date = new Date()): RangoPagos {
  const a = base.getFullYear();
  const m = base.getMonth();
  return { desde: iso(a, m, 1), hasta: iso(a, m, ultimoDiaDelMes(a, m)) };
}

/** Trimestre calendario que contiene a `base`. */
export function rangoTrimestrePagos(base: Date = new Date()): RangoPagos {
  const a = base.getFullYear();
  const inicio = Math.floor(base.getMonth() / 3) * 3;
  const fin = inicio + 2;
  return { desde: iso(a, inicio, 1), hasta: iso(a, fin, ultimoDiaDelMes(a, fin)) };
}

/** Año calendario de `base`. */
export function rangoAnioPagos(base: Date = new Date()): RangoPagos {
  const a = base.getFullYear();
  return { desde: iso(a, 0, 1), hasta: iso(a, 11, 31) };
}

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

/** Filtra los pagos ya traídos del servidor. */
export function filtrarPagos(
  pagos: readonly PagoLibro[],
  f: FiltrosLibroPagos,
): PagoLibro[] {
  const q = normalizarTextoPago(f.texto);
  return pagos.filter((p) => {
    if (!coincideVista(p, f.vista)) return false;
    if (f.cuentaId !== "todas" && p.cuenta_bancaria_id !== f.cuentaId) return false;
    if (f.moneda !== "todas" && p.moneda !== f.moneda) return false;
    if (f.metodo !== "todos" && (p.metodo_pago ?? "") !== f.metodo) return false;
    if (f.conciliacion === "conciliados" && !p.conciliado) return false;
    if (f.conciliacion === "pendientes" && p.conciliado) return false;
    if (!coincideRep(p, f.rep)) return false;
    if (!q) return true;
    const campo = normalizarTextoPago(
      `${p.contraparte ?? ""} ${p.documento_folio ?? ""} ${p.referencia ?? ""} ${p.notas ?? ""}`,
    );
    return campo.includes(q);
  });
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

/** Ruta del documento (factura de cliente o de proveedor) que liquidó el pago. */
export function rutaDocumento(pago: PagoLibro): string | null {
  if (!pago.documento_id) return null;
  return pago.tipo === "cobro"
    ? `/facturacion/${pago.documento_id}`
    : `/compras/facturas/${pago.documento_id}`;
}

/** Ruta al estado de cuenta bancario donde vive el movimiento conciliado. */
export function rutaMovimiento(pago: PagoLibro): string | null {
  if (!pago.conciliado || !pago.cuenta_bancaria_id) return null;
  return `/tesoreria/estado-cuenta?cuenta=${pago.cuenta_bancaria_id}`;
}
