/**
 * Tarifario: tarifas vigentes (puertos base) agrupadas 20"/40" y cargos
 * FOB de agentes / locales de revalidación por naviera.
 */
import { z } from "zod";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";

const nombre = z.object({ name: z.string(), country: z.string().nullable().optional() }).passthrough().nullable();
const tarifaDbSchema = z.array(z.object({
  id: z.string(),
  flete_base: z.number(),
  moneda: z.string(),
  dias_libres_demoras: z.number().nullable(),
  vigente_desde: z.string().nullable(),
  vigente_hasta: z.string().nullable(),
  notas: z.string().nullable(),
  solicitud_pricing_id: z.string().nullable(),
  agente: z.object({ id: z.string(), nombre: z.string() }).passthrough().nullable(),
  naviera: z.object({ id: z.string(), name: z.string() }).passthrough().nullable(),
  tipo: z.object({ code: z.string(), name: z.string().optional() }).passthrough().nullable(),
  ruta: z.object({ origen: nombre, destino: nombre }).passthrough().nullable(),
}).passthrough());

export type TarifaTarifario = z.infer<typeof tarifaDbSchema>[number];

const COLS = [
  "id, flete_base, moneda, dias_libres_demoras, vigente_desde, vigente_hasta, notas, solicitud_pricing_id",
  "agente:costeo_agentes(id, nombre), naviera:navieras(id, name), tipo:tipos_contenedor(code, name)",
  "ruta:costeo_rutas(origen:puertos!costeo_rutas_puerto_origen_id_fkey(name, country), destino:puertos!costeo_rutas_puerto_destino_id_fkey(name, country))",
].join(", ");

const DIA_MS = 86_400_000;

/** Regla de negocio: una tarifa nacida de solicitud entra al tarifario sólo si su vigencia dura más de 1 día. */
export function entraAlTarifario(t: Pick<TarifaTarifario, "solicitud_pricing_id" | "vigente_desde" | "vigente_hasta">): boolean {
  if (!t.solicitud_pricing_id) return true;
  if (!t.vigente_desde || !t.vigente_hasta) return false;
  return Date.parse(t.vigente_hasta) - Date.parse(t.vigente_desde) > DIA_MS;
}

/** Filtro de vigencia de la vista 1 del tarifario. */
export type FiltroVigencia = "vigentes" | "proximas" | "vencidas" | "todas";

export const FILTROS_VIGENCIA: { valor: FiltroVigencia; etiqueta: string }[] = [
  { valor: "vigentes", etiqueta: "Vigentes hoy" },
  { valor: "proximas", etiqueta: "Próximas a iniciar" },
  { valor: "vencidas", etiqueta: "Vencidas" },
  { valor: "todas", etiqueta: "Todas" },
];

export type Vigencia = "vigente" | "proxima" | "vencida";

/** Estado de vigencia de una tarifa comparado contra una fecha YYYY-MM-DD. */
export function estadoVigencia(
  t: Pick<TarifaTarifario, "vigente_desde" | "vigente_hasta">, hoy: string,
): Vigencia {
  if (t.vigente_desde && t.vigente_desde > hoy) return "proxima";
  if (t.vigente_hasta && t.vigente_hasta < hoy) return "vencida";
  return "vigente";
}

export async function listarTarifasTarifario(filtro: FiltroVigencia, hoy: string): Promise<TarifaTarifario[]> {
  const data = await leerTodasLasPaginas("costeo.tarifario", (desde, hasta) => {
    let q = supabase.from("costeo_tarifas").select(COLS).eq("estado", "vigente")
      .order("vigente_hasta", { ascending: false }).order("id");
    if (filtro === "vigentes") {
      q = q.or(`vigente_desde.is.null,vigente_desde.lte.${hoy}`).or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`);
    } else if (filtro === "proximas") {
      q = q.gt("vigente_desde", hoy);
    } else if (filtro === "vencidas") {
      q = q.lt("vigente_hasta", hoy);
    }
    return q.range(desde, hasta);
  });
  return fromDb(data ?? [], tarifaDbSchema).filter(entraAlTarifario);
}

export interface FilaTarifario {
  clave: string;
  origen: string;
  destino: string;
  agente: string;
  naviera: string;
  tarifa20: TarifaTarifario | null;
  tarifa40: TarifaTarifario | null;
  otras: TarifaTarifario[];
  base: TarifaTarifario;
}

const es20 = (code: string) => code.startsWith("20");
const es40 = (code: string) => code.startsWith("40");

/** Agrupa 20"/40" de la misma ruta+agente+naviera+vigencia en una fila. */
export function agruparTarifas(tarifas: readonly TarifaTarifario[]): FilaTarifario[] {
  const mapa = new Map<string, FilaTarifario>();
  for (const t of tarifas) {
    const clave = claveTarifa(t);
    let f = mapa.get(clave);
    if (!f) {
      f = nuevaFilaTarifario(t, clave);
      mapa.set(clave, f);
    }
    const code = t.tipo?.code ?? "";
    if (es20(code) && !f.tarifa20) f.tarifa20 = t;
    else if (es40(code) && !f.tarifa40) f.tarifa40 = t;
    else f.otras.push(t);
  }
  return [...mapa.values()];
}

function claveTarifa(t: TarifaTarifario): string {
  return [t.ruta?.origen?.name, t.ruta?.destino?.name, t.agente?.id, t.naviera?.id, t.vigente_desde, t.vigente_hasta].join("|");
}

function nuevaFilaTarifario(t: TarifaTarifario, clave: string): FilaTarifario {
  return { clave, origen: t.ruta?.origen?.name ?? "—", destino: t.ruta?.destino?.name ?? "—",
    agente: t.agente?.nombre ?? "—", naviera: t.naviera?.name ?? "—", tarifa20: null, tarifa40: null, otras: [], base: t };
}

