/**
 * Lógica de dominio pura del wizard de embarques.
 * Sin React, sin servicios — solo transformaciones e invariantes.
 *
 * Cubre:
 * - Validación del paso 1 (Datos Generales).
 * - Hidratación de conceptos venta/costo a partir de una cotización.
 */
import type { CotizacionRow } from "@/hooks/cotizacion/useCotizaciones";
import type { EmbarqueValidationErrors } from "@/components/embarque/StepDatosGenerales";
import { parseConceptos } from "@/lib/parsers/cotizacionDetalle";

export interface ConceptoVentaWizard {
  id: number;
  concepto: string;
  cantidad: number;
  precioUnitario: number;
  moneda: string;
}

export interface ConceptoCostoWizard {
  id: number;
  proveedorId: string;
  concepto: string;
  monto: number;
  moneda: string;
}

export interface CostoCotizacion {
  proveedor: string;
  concepto: string;
  costo_unitario: number | string;
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
    return {
      id: idx + 1,
      proveedorId: provMatch?.id ?? "",
      concepto: c.concepto,
      monto: Number(c.costo_unitario) || 0,
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
