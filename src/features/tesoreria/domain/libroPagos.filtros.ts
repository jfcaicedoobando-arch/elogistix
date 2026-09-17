/**
 * Filtros en memoria del libro maestro de pagos.
 *
 * Extraído de `libroPagos.ts` para respetar el límite de 200 líneas por
 * archivo (Power of 10). Sin red ni React: sólo predicados puros.
 */
import type { FiltrosLibroPagos, FiltroRep, PagoLibro, VistaLibroPagos } from "./libroPagos.tipos";

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
