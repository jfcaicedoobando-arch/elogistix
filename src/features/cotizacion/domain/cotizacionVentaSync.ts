/**
 * B-081 — Reglas de dominio para detectar cuándo los importes capturados en el
 * paso 2 (Costos) NO llegaron a `cotizaciones.conceptos_venta`.
 *
 * Causa raíz del bug del PDF en $0.00 (COT-2026-0167): un renglón de costo con
 * precio de venta capturado pero SIN nombre de concepto se descartaba en
 * silencio en `buildConceptosFromCostos`, así que la cotización quedaba con
 * `subtotal = 0` y el PDF imprimía ceros.
 */
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";

export interface CostoConImportes {
  concepto: string;
  /** Texto libre del proveedor del renglón (v13.823.305: requerido con importes). */
  proveedor?: string | null;
  costo_unitario: number;
  precio_venta?: number | null;
  cantidad?: number;
}

/** ¿La fila tiene dinero capturado (costo o venta)? */
export function tieneImportes(fila: CostoConImportes): boolean {
  return Number(fila.costo_unitario) > 0 || Number(fila.precio_venta ?? 0) > 0;
}

/**
 * Renglones que se perderían al generar conceptos de venta: tienen importes
 * pero el concepto está vacío.
 */
export function costosSinConcepto<T extends CostoConImportes>(filas: T[]): T[] {
  return filas.filter((f) => tieneImportes(f) && !(f.concepto ?? "").trim());
}

/**
 * v13.823.305 (COT-2026-0245): renglones con importes y sin proveedor. Sin
 * proveedor el costo llega al embarque sin a quién pagarle, así que el paso 2
 * lo exige de una vez.
 */
export function costosSinProveedor<T extends CostoConImportes>(filas: T[]): T[] {
  return filas.filter((f) => tieneImportes(f) && !(f.proveedor ?? "").trim());
}

/** ¿Esta fila del paso 2 debe marcarse por proveedor faltante? */
export function filaSinProveedor(fila: FilaCostoLocal): boolean {
  return tieneImportes(fila) && !(fila.proveedor ?? "").trim();
}

/** Índices (base 0) de los renglones inválidos, para resaltarlos en la tabla. */
export function indicesCostosSinConcepto(filas: CostoConImportes[]): number[] {
  return filas.reduce<number[]>((acc, f, idx) => {
    if (tieneImportes(f) && !(f.concepto ?? "").trim()) acc.push(idx);
    return acc;
  }, []);
}

/** ¿Esta fila del paso 2 debe marcarse en rojo por concepto faltante? */
export function filaCostoInvalida(fila: FilaCostoLocal): boolean {
  return tieneImportes(fila) && !(fila.concepto ?? "").trim();
}

/**
 * ¿La cotización quedó "en cero" aunque los costos sí tengan precio de venta?
 * Señal para ofrecer la sincronización manual desde el detalle.
 */
export function requiereSincronizarVenta(
  costos: CostoConImportes[],
  totalConceptosVenta: number,
): boolean {
  const hayVentaEnCostos = costos.some((c) => Number(c.precio_venta ?? 0) > 0);
  return hayVentaEnCostos && totalConceptosVenta <= 0;
}

/** Renglón de venta tal como lo captura el paso 3 del wizard. */
export interface ConceptoVentaLike {
  descripcion?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  moneda?: string | null;
}

/**
 * v13.823.357 (Auditoría YAGNI P2 #6/#7 y P1 #1): valida los conceptos de venta
 * con el MISMO contrato que la base (`_assert_cotizacion_venta_valida`):
 * cantidad y precio deben ser positivos, la moneda sólo MXN/USD, y debe existir
 * al menos un renglón con importe. Devuelve el mensaje a mostrar o `null`.
 */
export function errorConceptosVenta(conceptos: ConceptoVentaLike[]): string | null {
  const conImporte = conceptos.filter((c) => (c.descripcion ?? "").trim());
  if (conImporte.length === 0) return null; // el schema del paso ya cubre "sin conceptos"
  for (const c of conImporte) {
    const moneda = String(c.moneda ?? "USD").trim().toUpperCase();
    if (moneda !== "MXN" && moneda !== "USD") return COPY_VALIDACION.conceptosVentaMonedaNoSoportada;
  }
  const invalidos = conImporte.filter(
    (c) => !(Number(c.cantidad ?? 1) > 0) || !(Number(c.precio_unitario ?? 0) > 0),
  );
  if (invalidos.length === conImporte.length) return COPY_VALIDACION.conceptosVentaSinImporte;
  if (invalidos.length > 0) return COPY_VALIDACION.conceptosVentaImporteInvalido;
  return null;
}
