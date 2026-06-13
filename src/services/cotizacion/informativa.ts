/**
 * Servicios para cotización informativa (tarifario).
 * Maneja inserción y conversión hacia/desde el payload de Supabase.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { fromDb, toDbJson } from "@/lib/supabase/cast";
import type { CotizacionRow } from "@/types/cotizacion";
import type {
  CotizacionInformativaInput,
  TarifaInformativa,
} from "@/types/cotizacion";
import { generarFolioCotizacion } from "./queries";

type CotizacionInsert = TablesInsert<"cotizaciones">;

function buildPartesClienteInformativa(input: CotizacionInformativaInput) {
  return {
    cliente_id: input.es_prospecto ? null : input.cliente_id,
    cliente_nombre: input.cliente_nombre,
    es_prospecto: input.es_prospecto,
    prospecto_empresa: input.prospecto_empresa ?? "",
    prospecto_contacto: input.prospecto_contacto ?? "",
    prospecto_email: input.prospecto_email ?? "",
    prospecto_telefono: input.prospecto_telefono ?? "",
  };
}

function buildInsertInformativa(
  input: CotizacionInformativaInput,
  folio: string,
): CotizacionInsert {
  return {
    folio,
    tipo_documento: "informativa",
    vigencia_desde: input.vigencia_desde,
    vigencia_hasta: input.vigencia_hasta,
    tarifas_informativas: toDbJson(input.tarifas),
    fecha_vigencia: input.vigencia_hasta,
    // Defaults requeridos por el resto del esquema (no aplican a informativa):
    modo: "Marítimo" as CotizacionInsert["modo"],
    tipo: "Importación" as CotizacionInsert["tipo"],
    incoterm: "N/A" as CotizacionInsert["incoterm"],
    descripcion_mercancia: "Tarifario informativo",
    peso_kg: 0,
    volumen_m3: 0,
    piezas: 0,
    origen: input.tarifas[0]?.origen ?? "",
    destino: input.tarifas[0]?.destino ?? "",
    conceptos_venta: toDbJson([]),
    subtotal: 0,
    moneda: "USD" as CotizacionInsert["moneda"],
    vigencia_dias: 0,
    operador: input.operador,
    notas: input.notas ?? null,
    estado: "Enviada" as CotizacionInsert["estado"],
    ...buildPartesClienteInformativa(input),
  };
}

export async function crearCotizacionInformativa(
  input: CotizacionInformativaInput,
): Promise<CotizacionRow> {
  const folio = await generarFolioCotizacion();
  const payload = buildInsertInformativa(input, folio);
  const { data, error } = await supabase
    .from("cotizaciones")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return fromDb<CotizacionRow>(data);
}

/**
 * Parseo defensivo del jsonb `tarifas_informativas` a arreglo tipado.
 * Tolera filas con campos faltantes (legacy / corruptas).
 */
export function parseTarifasInformativas(raw: unknown): TarifaInformativa[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r, idx) => ({
      id: String(r.id ?? `t-${idx}`),
      modo: String(r.modo ?? ""),
      modalidad_equipo: r.modalidad_equipo ? String(r.modalidad_equipo) : "",
      origen: String(r.origen ?? ""),
      punto_intermedio: r.punto_intermedio ? String(r.punto_intermedio) : "",
      destino: String(r.destino ?? ""),
      tipo_contenedor: r.tipo_contenedor ? String(r.tipo_contenedor) : "",
      unidad_medida: String(r.unidad_medida ?? "Contenedor"),
      precio: Number(r.precio ?? 0),
      moneda: String(r.moneda ?? "USD"),
      notas: r.notas ? String(r.notas) : "",
    }));
}
