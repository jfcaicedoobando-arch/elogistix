/**
 * Reglas puras para "Next Best Actions" del vendedor.
 * Combina señales de leads, oportunidades, cotizaciones sin respuesta y
 * actividades vencidas, y devuelve hasta `limit` acciones ordenadas por score.
 *
 * El score es estable: la prioridad la fija la regla, los desempates van por
 * antigüedad (más viejo, más urgente).
 */
import { hoyMx, parseLocalMx } from "@/lib/date/mx";
import { NBA_LEAD_SIN_CONTACTAR_HORAS } from "./umbralesContacto";

export interface NbaLead {
  id: string;
  empresa: string;
  created_at: string;
}

export interface NbaOportunidad {
  id: string;
  nombre: string;
  fecha_estimada_cierre: string | null;
  updated_at: string;
}

export interface NbaCotizacionSinRespuesta {
  id: string;
  folio: string;
  cliente_nombre: string;
  dias: number;
  oportunidad_id: string | null;
}

export interface NbaActividadVencida {
  id: string;
  asunto: string;
  fecha_programada: string | null;
  entidad_tipo: string;
  entidad_id: string;
}

export type NbaIcono = "lead" | "cotizacion" | "cierre" | "stale" | "actividad";

export interface NbaItem {
  id: string;
  regla:
    | "lead_sin_contactar"
    | "cot_sin_respuesta"
    | "op_cierre_proximo"
    | "op_sin_actividad"
    | "actividad_vencida";
  titulo: string;
  subtitulo: string;
  href: string;
  score: number;
  icono: NbaIcono;
}

export interface NbaInput {
  leadsSinContactar: NbaLead[];
  oportunidadesAbiertas: NbaOportunidad[];
  cotizacionesSinRespuesta: NbaCotizacionSinRespuesta[];
  actividadesVencidas: NbaActividadVencida[];
  now?: Date;
}

const DIA = 86_400_000;
const HORA = 3_600_000;

function entidadHref(tipo: string, id: string): string {
  if (tipo === "lead") return `/crm/leads/${id}`;
  if (tipo === "oportunidad") return `/crm/oportunidades/${id}`;
  if (tipo === "cliente") return `/clientes/${id}`;
  return "#";
}

function nbaLeadsSinContactar(leads: NbaLead[], nowMs: number): NbaItem[] {
  const out: NbaItem[] = [];
  for (const l of leads) {
    const horas = Math.floor((nowMs - new Date(l.created_at).getTime()) / HORA);
    if (horas < NBA_LEAD_SIN_CONTACTAR_HORAS) continue;
    out.push({
      id: `lead:${l.id}`,
      regla: "lead_sin_contactar",
      titulo: `Contactar a ${l.empresa}`,
      subtitulo: `Lead nuevo · lleva ${horas}h sin atención`,
      href: `/crm/leads/${l.id}`,
      score: 100 - Math.min(20, Math.floor(horas / 24)),
      icono: "lead",
    });
  }
  return out;
}

function nbaCotSinRespuesta(cots: NbaCotizacionSinRespuesta[]): NbaItem[] {
  return cots.map((c) => ({
    id: `cot:${c.id}`,
    regla: "cot_sin_respuesta",
    titulo: `Dar seguimiento a cotización ${c.folio}`,
    subtitulo: `${c.cliente_nombre || "Sin cliente"} · ${c.dias} días sin respuesta`,
    href: c.oportunidad_id ? `/crm/oportunidades/${c.oportunidad_id}` : `/cotizaciones/${c.id}`,
    score: 90 - Math.min(20, c.dias - 5),
    icono: "cotizacion",
  }));
}

function nbaCierreProximo(ops: NbaOportunidad[], ahora: Date): NbaItem[] {
  const out: NbaItem[] = [];
  // FIX-9 (auditoría): `fecha_estimada_cierre` es `date` de Postgres (sin
  // hora) — compararlo contra un timestamp arbitrario en UTC corría el
  // resultado un día según la hora local. Se compara como día calendario
  // MX: "hoy" y la fecha de cierre se anclan ambos a mediodía UTC del
  // mismo día civil antes de restar.
  const hoyMs = parseLocalMx(hoyMx(ahora)).getTime();
  for (const o of ops) {
    if (!o.fecha_estimada_cierre) continue;
    const diasAlCierre = Math.round(
      (parseLocalMx(o.fecha_estimada_cierre).getTime() - hoyMs) / DIA,
    );
    if (diasAlCierre < 0 || diasAlCierre > 3) continue;
    out.push({
      id: `cierre:${o.id}`,
      regla: "op_cierre_proximo",
      titulo: `Cerrar ${o.nombre}`,
      subtitulo: `Cierre estimado en ${diasAlCierre} día${diasAlCierre === 1 ? "" : "s"}`,
      href: `/crm/oportunidades/${o.id}`,
      score: 85 - diasAlCierre,
      icono: "cierre",
    });
  }
  return out;
}

function nbaSinActividad(
  ops: NbaOportunidad[],
  yaIncluidos: Set<string>,
  nowMs: number,
): NbaItem[] {
  const out: NbaItem[] = [];
  for (const o of ops) {
    if (yaIncluidos.has(o.id)) continue;
    const diasSinMov = Math.floor((nowMs - new Date(o.updated_at).getTime()) / DIA);
    if (diasSinMov <= 7) continue;
    out.push({
      id: `stale:${o.id}`,
      regla: "op_sin_actividad",
      titulo: `${o.nombre} sin movimiento`,
      subtitulo: `Lleva ${diasSinMov} días sin actualización`,
      href: `/crm/oportunidades/${o.id}`,
      score: 70 - Math.min(20, diasSinMov - 7),
      icono: "stale",
    });
  }
  return out;
}

function nbaActividadesVencidas(actividades: NbaActividadVencida[], nowMs: number): NbaItem[] {
  return actividades.map((a) => {
    const diasVencida = a.fecha_programada
      ? Math.max(0, Math.floor((nowMs - new Date(a.fecha_programada).getTime()) / DIA))
      : 0;
    return {
      id: `act:${a.id}`,
      regla: "actividad_vencida",
      titulo: `Completar: ${a.asunto}`,
      subtitulo: a.fecha_programada
        ? `Vencida hace ${diasVencida} día${diasVencida === 1 ? "" : "s"}`
        : "Vencida",
      href: entidadHref(a.entidad_tipo, a.entidad_id),
      score: 110 + Math.min(20, diasVencida),
      icono: "actividad",
    };
  });
}

export function computeNextBestActions(input: NbaInput, limit = 5): NbaItem[] {
  const ahora = input.now ?? new Date();
  const nowMs = ahora.getTime();
  const cierre = nbaCierreProximo(input.oportunidadesAbiertas, ahora);
  const yaIncluidos = new Set(cierre.map((i) => i.id.split(":")[1]));
  return [
    ...nbaLeadsSinContactar(input.leadsSinContactar, nowMs),
    ...nbaCotSinRespuesta(input.cotizacionesSinRespuesta),
    ...cierre,
    ...nbaSinActividad(input.oportunidadesAbiertas, yaIncluidos, nowMs),
    ...nbaActividadesVencidas(input.actividadesVencidas, nowMs),
  ].sort((a, b) => b.score - a.score).slice(0, limit);
}

