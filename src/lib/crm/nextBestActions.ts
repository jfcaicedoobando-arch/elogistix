/**
 * Reglas puras para "Next Best Actions" del vendedor.
 * Combina señales de leads, oportunidades, cotizaciones sin respuesta y
 * actividades vencidas, y devuelve hasta `limit` acciones ordenadas por score.
 *
 * El score es estable: la prioridad la fija la regla, los desempates van por
 * antigüedad (más viejo, más urgente).
 */

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

export function computeNextBestActions(input: NbaInput, limit = 5): NbaItem[] {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const items: NbaItem[] = [];

  // 1) Leads nuevos sin contactar > 24h (score 100, restamos días de antigüedad)
  for (const l of input.leadsSinContactar) {
    const horas = Math.floor((nowMs - new Date(l.created_at).getTime()) / HORA);
    if (horas < 24) continue;
    items.push({
      id: `lead:${l.id}`,
      regla: "lead_sin_contactar",
      titulo: `Contactar a ${l.empresa}`,
      subtitulo: `Lead nuevo · lleva ${horas}h sin atención`,
      href: `/crm/leads/${l.id}`,
      score: 100 - Math.min(20, Math.floor(horas / 24)),
      icono: "lead",
    });
  }

  // 2) Cotizaciones enviadas sin respuesta > 5 días
  for (const c of input.cotizacionesSinRespuesta) {
    const href = c.oportunidad_id
      ? `/crm/oportunidades/${c.oportunidad_id}`
      : `/cotizaciones/${c.id}`;
    items.push({
      id: `cot:${c.id}`,
      regla: "cot_sin_respuesta",
      titulo: `Dar seguimiento a cotización ${c.folio}`,
      subtitulo: `${c.cliente_nombre || "Sin cliente"} · ${c.dias} días sin respuesta`,
      href,
      score: 90 - Math.min(20, c.dias - 5),
      icono: "cotizacion",
    });
  }

  // 3) Oportunidades con cierre estimado en ≤ 3 días y sin movimiento reciente
  for (const o of input.oportunidadesAbiertas) {
    if (!o.fecha_estimada_cierre) continue;
    const diasAlCierre = Math.floor(
      (new Date(o.fecha_estimada_cierre).getTime() - nowMs) / DIA,
    );
    if (diasAlCierre < 0 || diasAlCierre > 3) continue;
    items.push({
      id: `cierre:${o.id}`,
      regla: "op_cierre_proximo",
      titulo: `Cerrar ${o.nombre}`,
      subtitulo: `Cierre estimado en ${diasAlCierre} día${diasAlCierre === 1 ? "" : "s"}`,
      href: `/crm/oportunidades/${o.id}`,
      score: 85 - diasAlCierre,
      icono: "cierre",
    });
  }

  // 4) Oportunidades sin actividad > 7 días (sin contar las del cierre próximo)
  const yaIncluidasOp = new Set(
    items.filter((i) => i.regla === "op_cierre_proximo").map((i) => i.id.split(":")[1]),
  );
  for (const o of input.oportunidadesAbiertas) {
    if (yaIncluidasOp.has(o.id)) continue;
    const diasSinMov = Math.floor((nowMs - new Date(o.updated_at).getTime()) / DIA);
    if (diasSinMov <= 7) continue;
    items.push({
      id: `stale:${o.id}`,
      regla: "op_sin_actividad",
      titulo: `${o.nombre} sin movimiento`,
      subtitulo: `Lleva ${diasSinMov} días sin actualización`,
      href: `/crm/oportunidades/${o.id}`,
      score: 70 - Math.min(20, diasSinMov - 7),
      icono: "stale",
    });
  }

  // 5) Actividades vencidas
  for (const a of input.actividadesVencidas) {
    items.push({
      id: `act:${a.id}`,
      regla: "actividad_vencida",
      titulo: `Completar: ${a.asunto}`,
      subtitulo: a.fecha_programada
        ? `Vencida desde ${new Date(a.fecha_programada).toLocaleDateString("es-MX")}`
        : "Vencida",
      href: entidadHref(a.entidad_tipo, a.entidad_id),
      score: 60,
      icono: "actividad",
    });
  }

  return items.sort((a, b) => b.score - a.score).slice(0, limit);
}
