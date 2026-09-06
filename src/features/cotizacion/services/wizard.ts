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
import { requiereTransicionABorrador } from "@/features/cotizacion/domain/estadosEditables";
import { derivarSubtotalMoneda } from "@/features/cotizacion/services/derivarSubtotalMoneda";


interface Mutations {
  crearCotizacion: { mutateAsync: (d: CreateCotizacionInput) => Promise<{ id: string }> };
  // Devuelve el nuevo `updated_at` (N-06) o void; al wizard le basta con esperarlo.
  updateCotizacion: { mutateAsync: (d: { id: string; data: Record<string, unknown> }) => Promise<unknown> };
  upsertCostos: {
    mutateAsync: (d: {
      cotizacionId: string;
      costos: CostoCotizacion[];
      /** v13.823.69: sello esperado de la cotización (bloqueo optimista del paso 2). */
      expectedUpdatedAt?: string | null;
    }) => Promise<{ costos: CostoCotizacion[]; updatedAt: string | null }>;
  };
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

  const hayMsds = v.tipoCarga === "Mercancía Peligrosa" && !!msdsFile;
  const data = buildPaso1Data();

  if (cotizacionId) {
    // En UPDATE el registro ya existe: subir el MSDS antes es seguro.
    const msdsArchivo = hayMsds ? await subirMsds(msdsFile as File) : null;
    if (msdsArchivo) data.msds_archivo = msdsArchivo;
    // BL-3: en UPDATE nunca se escribe `msds_archivo` si no hubo archivo nuevo.
    // Antes se mandaba `null` y cualquier edición de una cotización de mercancía
    // peligrosa borraba el documento de seguridad ya cargado.
    if (!msdsArchivo) delete data.msds_archivo;
    // B-074: buildPaso1Data siempre trae `conceptos_venta: []` y `subtotal: 0`
    // (las ventas viven en el estado del paso 3, no en el form). En UPDATE hay
    // que excluirlos para no pisar lo ya guardado — el caso típico es volver
    // al paso 1 para un override de tarifa tras haber completado el paso 3.
    delete data.conceptos_venta;
    delete data.subtotal;
    // A1/A7: con importes ya capturados el mapper no propone moneda; nunca se
    // sobrescribe la moneda persistida desde el paso 1.
    if (data.moneda === undefined) delete data.moneda;
    await mutations.updateCotizacion.mutateAsync({ id: cotizacionId, data });
    return cotizacionId;
  }
  // W-13 (QA r2): en CREATE primero se crea la cotización y DESPUÉS se sube el
  // MSDS. Antes el orden era inverso: si la creación fallaba, el PDF quedaba
  // huérfano en el almacenamiento.
  data.msds_archivo = null;
  const cotizacion = await mutations.crearCotizacion.mutateAsync(fromDb<CreateCotizacionInput>(data));
  if (hayMsds) {
    const msdsArchivo = await subirMsds(msdsFile as File);
    await mutations.updateCotizacion.mutateAsync({
      id: cotizacion.id,
      data: { msds_archivo: msdsArchivo },
    });
  }
  return cotizacion.id;
}

/** Sube el MSDS al bucket de la organización y devuelve su ruta. */
async function subirMsds(file: File): Promise<string> {
  // v13.420.0 (Sentry JAVASCRIPT-REACT-4M): ruta con organization_id raíz.
  const { buildMsdsPath } = await import("@/services/storage/orgPath");
  const path = await buildMsdsPath(file.name);
  await uploadFile(path, file);
  return path;
}

/**
 * Guarda los costos internos del paso 2. Devuelve el nuevo sello
 * (`cotizaciones.updated_at`) que la RPC entrega tras tocar la cotización, o
 * `null` si no hubo nada que guardar (v13.823.69).
 */
export async function savePaso2(opts: {
  cotizacionId: string;
  costosInternos: FilaCostoLocal[];
  /** Sello esperado: si la cotización cambió, la RPC no reemplaza nada. */
  expectedUpdatedAt?: string | null;
  mutations: Pick<Mutations, "upsertCostos">;
}): Promise<string | null> {
  const { cotizacionId, costosInternos, expectedUpdatedAt, mutations } = opts;
  if (costosInternos.length === 0) return null;

  const costos: CostoCotizacion[] = costosInternos.map(f => ({
    id: "", cotizacion_id: cotizacionId, concepto: f.concepto, moneda: f.moneda,
    proveedor: f.proveedor, cantidad: f.cantidad, costo_unitario: f.costo_unitario,
    costo_total: f.cantidad * f.costo_unitario, precio_venta: f.precio_venta,
    unidad_medida: f.unidad_medida, notas: f.notas ?? "", created_at: "", updated_at: "",
    // B-073: propagar el linkage tarifa/recargo al upsert de costos.
    costeo_tarifa_id: f.costeo_tarifa_id ?? null,
    costeo_tarifa_recargo_id: f.costeo_tarifa_recargo_id ?? null,
  }));
  const res = await mutations.upsertCostos.mutateAsync({ cotizacionId, costos, expectedUpdatedAt });
  return res?.updatedAt ?? null;
}

// P1-A / A1/A7: la derivación de subtotal+moneda vive en su propio módulo.
export { MSG_COTIZACION_MIXTA, derivarSubtotalMoneda } from "@/features/cotizacion/services/derivarSubtotalMoneda";


export async function savePaso3(opts: {
  cotizacionId: string;
  conceptosVenta: Record<string, unknown>[];
  /**
   * Moneda canónica de la cotización (vínculo CRM o la ya persistida). Sólo se
   * usa cuando no hay ningún importe ni renglón que indique la divisa.
   */
  monedaFallback?: string | null;
  mutations: Pick<Mutations, "updateCotizacion">;
}): Promise<void> {
  const { cotizacionId, conceptosVenta, monedaFallback, mutations } = opts;
  // Lanza MSG_COTIZACION_MIXTA antes de tocar la BD: nada se persiste y los
  // conceptos capturados siguen en pantalla.
  const { subtotal, moneda } = derivarSubtotalMoneda(conceptosVenta, monedaFallback);
  await mutations.updateCotizacion.mutateAsync({
    id: cotizacionId,
    data: { conceptos_venta: conceptosVenta, subtotal, moneda },
  });
}



export async function savePasoFinal(opts: {
  cotizacionId: string;
  isEditMode: boolean;
  /** Estado actual de la cotización al abrir el wizard (P0-1 R5). */
  estadoActual?: string | null;
  mutations: Pick<Mutations, "updateCotizacion">;
  registrarActividad: (d: { accion: string; modulo: string; entidad_id?: string | null; entidad_nombre?: string }) => void;
}): Promise<void> {
  const { cotizacionId, isEditMode, estadoActual, mutations, registrarActividad } = opts;
  // P0-1 (R5): una cotización `Solicitada` (portal) pasa a `Borrador` al costearse,
  // para que siga el flujo estándar Borrador → Enviada → Aceptada.
  if (!isEditMode || requiereTransicionABorrador(estadoActual)) {
    await mutations.updateCotizacion.mutateAsync({ id: cotizacionId, data: { estado: "Borrador" } });
  }

  registrarActividad({
    accion: isEditMode ? "editar" : "crear", modulo: "cotizaciones",
    entidad_id: cotizacionId, entidad_nombre: "",
  });
}
