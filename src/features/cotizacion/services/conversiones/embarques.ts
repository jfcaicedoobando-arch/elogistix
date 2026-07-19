/**
 * Cotizaciones — Conversión: Cotización → 1 embarque con N contenedores hijos.
 * Modelo 1↔N (v12.10): cotización con N contenedores genera UN embarque + N hijos.
 * Costos "Contenedor" se replican por hijo; "BL" se insertan una vez (general).
 * Helpers extraídos a `embarquesHelpers.ts` (12.33.0).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { CotizacionRow } from "@/features/cotizacion/types";
import {
  construirHijosPayload,
  construirCostosRows,
  parsearVentasJsonb,
} from "./embarquesHelpers";
import { revalidarTarifa } from "@/features/cotizacion/services/revalidacion";
import {
  RevalidacionRequeridaError,
  type ResultadoRevalidacion,
} from "@/features/cotizacion/domain/revalidacionTarifa";

type CotizacionInsert = TablesInsert<"cotizaciones">;
type EmbarqueInsert = TablesInsert<"embarques">;

/**
 * Fase R.6 (Bug 18): pre-check en cliente. Bloquea la conversión si la tarifa
 * de la cotización cambió, venció o quedó por fuera del umbral. La misma
 * validación está reforzada en BD dentro de la RPC 1-arg
 * `crear_embarque_borrador_desde_cotizacion(uuid)` mediante
 * `enforce_revalidacion_sin_cambios`.
 */
async function assertTarifaSinCambios(cotizacionId: string): Promise<ResultadoRevalidacion> {
  const r = await revalidarTarifa(cotizacionId);
  if (r.severidad !== "sin_cambios") {
    throw new RevalidacionRequeridaError(
      r,
      "La tarifa de la cotización cambió o venció. Usa el flujo de revalidación (Crear embarque) para mantener, refrescar, sustituir o pedir reaprobación antes de generar el embarque.",
    );
  }
  return r;
}


/** Inserta costos en lotes (BL una vez, por contenedor para el resto). */
async function insertarCostosEmbarque(
  costos: Tables<"cotizacion_costos">[] | null,
  embarqueId: string,
  hijos: Tables<"embarque_contenedores">[] | null,
): Promise<void> {
  if (!costos || costos.length === 0 || !hijos || hijos.length === 0) return;
  const rows = construirCostosRows(costos, embarqueId, hijos);
  if (rows.length === 0) return;
  const { error } = await supabase.from("conceptos_costo").insert(rows);
  if (error) throw error;
}

/** Inserta conceptos_venta parseando el jsonb de la cotización. */
async function insertarVentasEmbarque(
  ventasJsonb: unknown[],
  embarqueId: string,
  hijos: Tables<"embarque_contenedores">[] | null,
): Promise<void> {
  if (ventasJsonb.length === 0) return;
  const ventasRows = parsearVentasJsonb(ventasJsonb, embarqueId, hijos ?? undefined);
  if (ventasRows.length === 0) return;
  const { error } = await supabase.from("conceptos_venta").insert(ventasRows);
  if (error) throw error;
}

export async function convertirCotizacionAEmbarques(
  cotizacion: CotizacionRow,
): Promise<Tables<"embarques">[]> {
  if (cotizacion.tipo_documento === "informativa") {
    throw new Error("Las cotizaciones informativas (tarifarios) no pueden convertirse a embarques");
  }
  // Fase R.6 (Bug 18): revalidación de tarifa obligatoria antes de insertar.
  await assertTarifaSinCambios(cotizacion.id);

  const { data: costos, error: errorCostos } = await supabase
    .from("cotizacion_costos")
    .select("*")
    .eq("cotizacion_id", cotizacion.id);
  if (errorCostos) throw errorCostos;

  const numContenedores = Math.max(1, cotizacion.num_contenedores ?? 1);
  const pesoTotal = Number(cotizacion.peso_kg ?? 0);
  const volumenTotal = Number(cotizacion.volumen_m3 ?? 0);
  const piezasTotal = Number(cotizacion.piezas ?? 0);

  // 1) Expediente único para el embarque consolidado.
  // FIX 13.135.28: castear a string para evitar que supabase-js infiera el
  // enum `tipo_operacion` y PostgREST falle buscando la firma.
  const { data: expediente, error: errorExp } = await supabase.rpc("generar_expediente", {
    tipo_op: String(cotizacion.tipo),
  });
  if (errorExp) throw errorExp;

  // 2) Crear el embarque (campos legacy quedan como caché del primer hijo vía trigger).
  const embarqueInsert: EmbarqueInsert = {
    cotizacion_id: cotizacion.id,
    expediente: expediente as string,
    cliente_id: cotizacion.cliente_id!,
    cliente_nombre: cotizacion.cliente_nombre,
    estado: "Confirmado",
    modo: cotizacion.modo,
    tipo: cotizacion.tipo,
    incoterm: cotizacion.incoterm,
    descripcion_mercancia: cotizacion.descripcion_mercancia,
    peso_kg: pesoTotal,
    volumen_m3: volumenTotal,
    piezas: piezasTotal,
    operador: cotizacion.operador,
    tipo_carga: cotizacion.tipo_carga,
    tipo_contenedor: cotizacion.tipo_contenedor,
  };

  const { data: embarque, error: errorEmb } = await supabase
    .from("embarques")
    .insert(embarqueInsert)
    .select()
    .single();
  if (errorEmb) throw errorEmb;

  // 3) Crear los N contenedores hijos.
  const hijosPayload = construirHijosPayload(
    embarque.id, cotizacion, numContenedores,
    { pesoTotal, volumenTotal, piezasTotal },
  );
  const { data: hijosCreados, error: errorHijos } = await supabase
    .from("embarque_contenedores")
    .insert(hijosPayload)
    .select()
    .order("orden");
  if (errorHijos) throw errorHijos;

  // 4) Insertar costos (BL una vez, contenedor por hijo).
  await insertarCostosEmbarque(costos, embarque.id, hijosCreados);

  // 5) Insertar conceptos_venta desde el jsonb de la cotización (v12.13.1 hardening).
  const ventasJsonb = Array.isArray(cotizacion.conceptos_venta) ? cotizacion.conceptos_venta : [];
  await insertarVentasEmbarque(ventasJsonb, embarque.id, hijosCreados);

  // 6) Marcar cotización como "En operación" y vincularla al embarque.
  const { error: errorUpdate } = await supabase
    .from("cotizaciones")
    .update({
      estado: "En operación" as CotizacionInsert["estado"],
      embarque_id: embarque.id,
    })
    .eq("id", cotizacion.id);
  if (errorUpdate) throw errorUpdate;

  return [embarque];
}

/**
 * Crea un embarque borrador desde una cotización aceptada usando la RPC
 * `crear_embarque_borrador_desde_cotizacion`. Idempotente (devuelve el embarque
 * existente si la cotización ya tiene uno vinculado).
 */
export async function crearEmbarqueBorradorDesdeCotizacion(cotizacionId: string): Promise<string> {
  const { data: cot, error: errCot } = await supabase
    .from("cotizaciones")
    .select("tipo_documento")
    .eq("id", cotizacionId)
    .maybeSingle();
  if (errCot) throw errCot;
  if (cot?.tipo_documento === "informativa") {
    throw new Error("Las cotizaciones informativas (tarifarios) no pueden convertirse a embarques");
  }
  // Fase R.6 (Bug 18): pre-check + mapeo del token `LC_TARIFA_REQUIERE_REVALIDACION`.
  await assertTarifaSinCambios(cotizacionId);
  const { data, error } = await supabase.rpc("crear_embarque_borrador_desde_cotizacion", {
    p_cotizacion_id: cotizacionId,
  });
  if (error) {
    if (typeof error.message === "string" && /LC_TARIFA_REQUIERE_REVALIDACION/.test(error.message)) {
      // La revalidación cambió entre el pre-check y la RPC — rehidratar para el modal.
      const r = await revalidarTarifa(cotizacionId).catch(() => null);
      if (r) throw new RevalidacionRequeridaError(r);
    }
    throw error;
  }
  if (!data) throw new Error("La función no devolvió un embarque");
  return data as string;

}
