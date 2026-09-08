/**
 * Lógica de dominio pura del wizard de embarques.
 * Sin React, sin servicios — solo transformaciones e invariantes.
 *
 * Cubre:
 * - Validación del paso 1 (Datos Generales).
 * - Hidratación de conceptos venta/costo a partir de una cotización.
 */
import type { CotizacionRow } from "@/features/cotizacion/types";
import type { EmbarqueValidationErrors } from "@/features/embarques/types/embarque";
import { parseConceptos } from "@/lib/domain/cotizacionDetalle";

export interface ConceptoVentaWizard {
  id: number;
  concepto: string;
  cantidad: number;
  precioUnitario: number;
  moneda: string;
  /**
   * R201-COT-08 — Tratamiento fiscal capturado en la cotización. `null`
   * significa "la cotización no lo definió": no se infiere por moneda.
   */
  aplicaIva?: boolean | null;
  tasaIva?: number | null;
}

export interface ConceptoCostoWizard {
  id: number;
  proveedorId: string;
  concepto: string;
  monto: number;
  moneda: string;
}

export interface CostoCotizacion {
  proveedor: string | null;
  concepto: string;
  costo_unitario: number | string | null;
  /** R201-COT-05: cantidad y total generado de `cotizacion_costos`. */
  cantidad?: number | string | null;
  costo_total?: number | string | null;
  moneda: string | null;
}

export interface ProveedorRef {
  id: string;
  nombre: string;
}

export interface DatosGeneralesInput {
  modo?: string | null;
  tipo?: string | null;
  clienteId?: string | null;
  descripcionMercancia?: string | null;
}

/**
 * Valida los campos obligatorios del paso 1 (Datos Generales).
 * Devuelve un objeto con los errores por campo (vacío si todo OK).
 */
export function validateDatosGenerales(
  input: DatosGeneralesInput,
): EmbarqueValidationErrors {
  const errors: EmbarqueValidationErrors = {};
  if (!input.modo) errors.modo = "Selecciona un modo de transporte";
  if (!input.tipo) errors.tipo = "Selecciona un tipo de operación";
  if (!input.clienteId) errors.clienteId = "Selecciona un cliente";
  if (!(input.descripcionMercancia ?? "").trim()) {
    errors.descripcionMercancia = "Ingresa la descripción de la mercancía";
  }
  return errors;
}

export function isDatosGeneralesValid(input: DatosGeneralesInput): boolean {
  return Object.keys(validateDatosGenerales(input)).length === 0;
}

/** Número finito o `null` (no confundir 0 con "sin dato"). */
function numeroONull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Convierte los conceptos de venta de una cotización al formato del wizard
 * de embarques (numera las filas y aplica fallbacks).
 */
export function mapConceptosVentaFromCotizacion(
  cotizacion: CotizacionRow,
): ConceptoVentaWizard[] {
  const ventas = parseConceptos(cotizacion.conceptos_venta);
  return ventas.map((v, idx) => ({
      id: idx + 1,
      concepto: v.descripcion ?? "",
      cantidad: Number(v.cantidad) || 1,
      precioUnitario: Number(v.precio_unitario) || 0,
      moneda: v.moneda || "MXN",
      // R201-COT-08: el tratamiento fiscal viaja tal cual; `null` = no definido.
      aplicaIva: typeof v.aplica_iva === "boolean" ? v.aplica_iva : null,
      tasaIva: numeroONull(v.tasa_iva_aplicada),
    }));
}

/**
 * Convierte los costos provenientes de una cotización al formato del wizard,
 * resolviendo el `proveedorId` por nombre cuando exista en el catálogo.
 */
export function mapConceptosCostoFromCotizacion(
  costos: CostoCotizacion[],
  proveedores: ProveedorRef[],
): ConceptoCostoWizard[] {
  return costos.map((c, idx) => {
    const provMatch = proveedores.find((p) => p.nombre === c.proveedor);
    // R201-COT-05: el monto del embarque es el TOTAL del renglón cotizado.
    // Se respeta un 0 explícito y sólo se cae a cantidad × unitario si la BD
    // no entregó la columna generada.
    const total = numeroONull(c.costo_total);
    const unitario = numeroONull(c.costo_unitario) ?? 0;
    const cantidad = numeroONull(c.cantidad);
    const monto = total ?? unitario * (cantidad == null || cantidad === 0 ? 1 : cantidad);
    return {
      id: idx + 1,
      proveedorId: provMatch?.id ?? "",
      concepto: c.concepto,
      monto,
      moneda: c.moneda || "MXN",
    };
  });
}

// ── Orquestación del submit (pura, dependencias inyectadas) ───────────

export interface ExpedienteSeleccionRef {
  expediente: string;
  bl_master?: string | null;
}

export interface ResolverExpedienteArgs {
  modoExpediente: "nuevo" | "existente";
  expedienteSeleccionado: ExpedienteSeleccionRef | null;
  blMaster: string;
  tipo: string;
  resolverNuevo: (blMaster: string, tipo: string) => Promise<string>;
}

/**
 * Decide si reutilizar un expediente existente o resolver uno nuevo.
 * Pura: la resolución del nuevo expediente se delega a la función inyectada.
 */
export async function resolveExpedienteForSubmit(
  args: ResolverExpedienteArgs,
): Promise<string> {
  if (args.modoExpediente === "existente" && args.expedienteSeleccionado) {
    return args.expedienteSeleccionado.expediente;
  }
  return args.resolverNuevo(args.blMaster, args.tipo);
}

export interface BuildBitacoraDetallesArgs {
  modo: string;
  tipo: string;
  clienteNombre: string;
  cotizacionFolio: string | null;
  modoExpediente: "nuevo" | "existente";
}

export function buildBitacoraDetalles(args: BuildBitacoraDetallesArgs) {
  return {
    modo: args.modo,
    tipo: args.tipo,
    cliente: args.clienteNombre,
    cotizacion_folio: args.cotizacionFolio,
    asociado_a_existente: args.modoExpediente === "existente",
  };
}
