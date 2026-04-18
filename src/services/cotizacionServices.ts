/**
 * Funciones de guardado para cada paso del wizard de cotizaciones.
 * Extraídas de useCotizacionWizardForm para reducir complejidad del hook.
 */
import type { CotizacionFormValues } from "@/hooks/useCotizacionWizardForm";
import type { CreateCotizacionInput } from "@/hooks/useCotizaciones";
import type { CostoCotizacion } from "@/hooks/useCotizacionCostos";
import type { FilaCostoLocal } from "@/components/cotizacion/SeccionCostosInternosPLUnificado";
import { CONCEPTOS_CON_IVA_USD } from "@/data/cotizacionConstants";
import { calcularTotalConIVA } from "@/lib/financialUtils";
import { uploadFile } from "@/lib/storage";

// ── Types ──
interface Mutations {
  crearCotizacion: { mutateAsync: (d: CreateCotizacionInput) => Promise<{ id: string }> };
  updateCotizacion: { mutateAsync: (d: { id: string; data: Record<string, unknown> }) => Promise<void> };
  upsertCostos: { mutateAsync: (d: { cotizacionId: string; costos: CostoCotizacion[] }) => Promise<CostoCotizacion[]> };
}

// ── Paso 1: Datos generales ──
export async function savePaso1(opts: {
  form: { getValues: () => CotizacionFormValues };
  msdsFile: File | null;
  cotizacionId: string | null;
  buildPaso1Data: () => Record<string, unknown>;
  mutations: Pick<Mutations, "crearCotizacion" | "updateCotizacion">;
}): Promise<string> {
  const { form, msdsFile, cotizacionId, buildPaso1Data, mutations } = opts;
  const v = form.getValues();

  let msdsArchivo: string | null = null;
  if (v.tipoCarga === "Mercancía Peligrosa" && msdsFile) {
    const ext = msdsFile.name.split(".").pop() || "pdf";
    const path = `cotizaciones/msds-${Date.now()}.${ext}`;
    await uploadFile(path, msdsFile);
    msdsArchivo = path;
  }

  const data = buildPaso1Data();
  data.msds_archivo = msdsArchivo;

  if (cotizacionId) {
    await mutations.updateCotizacion.mutateAsync({ id: cotizacionId, data });
    return cotizacionId;
  } else {
    const cotizacion = await mutations.crearCotizacion.mutateAsync(data as unknown as CreateCotizacionInput);
    return cotizacion.id;
  }
}

// ── Paso 2: Costos internos ──
export async function savePaso2(opts: {
  cotizacionId: string;
  costosInternos: FilaCostoLocal[];
  mutations: Pick<Mutations, "upsertCostos">;
}): Promise<void> {
  const { cotizacionId, costosInternos, mutations } = opts;
  if (costosInternos.length === 0) return;

  const costos: CostoCotizacion[] = costosInternos.map(f => ({
    id: "", cotizacion_id: cotizacionId, concepto: f.concepto, moneda: f.moneda,
    proveedor: f.proveedor, cantidad: f.cantidad, costo_unitario: f.costo_unitario,
    costo_total: f.cantidad * f.costo_unitario, precio_venta: f.precio_venta,
    unidad_medida: f.unidad_medida, notas: f.notas ?? "", created_at: "", updated_at: "",
  }));
  await mutations.upsertCostos.mutateAsync({ cotizacionId, costos });
}

// ── Paso 2 → 3: Pre-llenar conceptos de venta desde costos ──
export interface ConceptoVentaPrellenado {
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  moneda: "USD" | "MXN";
  aplica_iva: boolean;
  total: number;
}

export function buildConceptosFromCostos(costosInternos: FilaCostoLocal[], tasaIva: number): {
  usd: ConceptoVentaPrellenado[];
  mxn: ConceptoVentaPrellenado[];
} {
  const usd = costosInternos
    .filter(c => c.moneda === "USD" && c.concepto.trim())
    .map(c => {
      const tieneIva = (CONCEPTOS_CON_IVA_USD as readonly string[]).includes(c.concepto);
      return {
        descripcion: c.concepto, unidad_medida: c.unidad_medida, cantidad: c.cantidad,
        precio_unitario: c.precio_venta, moneda: "USD" as const, aplica_iva: tieneIva,
        total: tieneIva ? calcularTotalConIVA(c.cantidad * c.precio_venta, tasaIva) : c.cantidad * c.precio_venta,
      };
    });

  const mxn = costosInternos
    .filter(c => c.moneda === "MXN" && c.concepto.trim())
    .map(c => ({
      descripcion: c.concepto, unidad_medida: c.unidad_medida, cantidad: c.cantidad,
      precio_unitario: c.precio_venta, moneda: "MXN" as const, aplica_iva: true,
      total: calcularTotalConIVA(c.cantidad * c.precio_venta, tasaIva),
    }));

  return { usd, mxn };
}

// ── Paso 3: Conceptos de venta ──
export async function savePaso3(opts: {
  cotizacionId: string;
  conceptosVenta: Record<string, unknown>[];
  totalUSD: number;
  mutations: Pick<Mutations, "updateCotizacion">;
}): Promise<void> {
  const { cotizacionId, conceptosVenta, totalUSD, mutations } = opts;
  await mutations.updateCotizacion.mutateAsync({
    id: cotizacionId,
    data: { conceptos_venta: conceptosVenta, subtotal: totalUSD },
  });
}

// ── Paso 4: Finalizar ──
export async function savePasoFinal(opts: {
  cotizacionId: string;
  isEditMode: boolean;
  mutations: Pick<Mutations, "updateCotizacion">;
  registrarActividad: (d: { accion: string; modulo: string; entidad_id?: string | null; entidad_nombre?: string }) => void;
}): Promise<void> {
  const { cotizacionId, isEditMode, mutations, registrarActividad } = opts;
  if (!isEditMode) {
    await mutations.updateCotizacion.mutateAsync({ id: cotizacionId, data: { estado: "Borrador" } });
  }
  registrarActividad({
    accion: isEditMode ? "editar" : "crear", modulo: "cotizaciones",
    entidad_id: cotizacionId, entidad_nombre: "",
  });
}
