/**
 * Cotizaciones — Wizard: orquestadores `savePaso1/2/3/Final` que persisten cada paso.
 *
 * NOTA: estas funciones usan tipos `Mutations` para no acoplarse a las mutaciones
 * concretas de React Query (las recibe el hook que las invoca). Es una concesión
 * deliberada para reutilizar el wizard tanto en NuevaCotizacion como en EditarCotizacion.
 */
import { uploadFile } from "@/services/storage/index";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
import type { CreateCotizacionInput } from "@/features/cotizacion/types";
import type { CostoCotizacion } from "@/features/cotizacion/types";
import type { FilaCostoLocal } from "@/features/cotizacion/types";
import { fromDb } from "@/lib/supabase/cast";

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
    // B-074: buildPaso1Data siempre trae `conceptos_venta: []` y `subtotal: 0`
    // (las ventas viven en el estado del paso 3, no en el form). En UPDATE hay
    // que excluirlos para no pisar lo ya guardado — el caso típico es volver
    // al paso 1 para un override de tarifa tras haber completado el paso 3.
    delete data.conceptos_venta;
    delete data.subtotal;
    await mutations.updateCotizacion.mutateAsync({ id: cotizacionId, data });
    return cotizacionId;
  } else {
    const cotizacion = await mutations.crearCotizacion.mutateAsync(fromDb<CreateCotizacionInput>(data));
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
    // B-073: propagar el linkage tarifa/recargo al upsert de costos.
    costeo_tarifa_id: f.costeo_tarifa_id ?? null,
    costeo_tarifa_recargo_id: f.costeo_tarifa_recargo_id ?? null,
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
