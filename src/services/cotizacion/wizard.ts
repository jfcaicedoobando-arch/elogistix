/**
 * Cotizaciones — Wizard: orquestadores `savePaso1/2/3/Final` que persisten cada paso.
 *
 * NOTA: estas funciones usan tipos `Mutations` para no acoplarse a las mutaciones
 * concretas de React Query (las recibe el hook que las invoca). Es una concesión
 * deliberada para reutilizar el wizard tanto en NuevaCotizacion como en EditarCotizacion.
 */
import { uploadFile } from "@/services/storage";
import type { CotizacionFormValues } from "@/types/cotizacionFormTypes";
import type { CreateCotizacionInput } from "@/types/cotizacionTypes";
import type { CostoCotizacion } from "@/types/cotizacionCostoTypes";
import type { FilaCostoLocal } from "@/types/cotizacionPLTypes";

interface Mutations {
  crearCotizacion: { mutateAsync: (d: CreateCotizacionInput) => Promise<{ id: string }> };
  updateCotizacion: { mutateAsync: (d: { id: string; data: Record<string, unknown> }) => Promise<void> };
  upsertCostos: { mutateAsync: (d: { cotizacionId: string; costos: CostoCotizacion[] }) => Promise<CostoCotizacion[]> };
}

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
