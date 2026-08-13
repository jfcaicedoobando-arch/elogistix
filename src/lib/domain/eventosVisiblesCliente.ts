/**
 * P2-6.4 — Filtro de eventos visibles para el cliente en el portal.
 *
 * El timeline del portal mostraba TODOS los eventos del embarque, incluidos
 * los internos o generados por pruebas automatizadas (harness E2E), lo que
 * exponía ruido operativo al cliente. Aquí sólo pasan hitos de negocio.
 *
 * Pura y testeable: sin React ni Supabase.
 */

/** Tipos de evento que representan hitos de negocio para el cliente. */
const TIPOS_VISIBLES: ReadonlySet<string> = new Set([
  "Zarpe",
  "Transbordo",
  "Arribo a Puerto",
  "Descarga",
  "Despacho Aduanal",
  "Liberación",
  "En Ruta Terrestre",
  "Entrega",
  "Cambio de ETA",
]);

/** Marcas que delatan un evento interno o de pruebas. */
const MARCAS_INTERNAS: readonly string[] = [
  "[interno]",
  "harness",
  "e2e",
  "seed",
  "qa-",
];

function tieneMarcaInterna(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  if (!t) return false;
  return MARCAS_INTERNAS.some((m) => t.includes(m));
}

export interface EventoVisibleLike {
  tipo: string;
  descripcion?: string | null;
  usuario?: string | null;
}

/** ¿Este evento debe verse en el portal del cliente? */
export function esEventoVisibleCliente(evento: EventoVisibleLike): boolean {
  if (!TIPOS_VISIBLES.has(evento.tipo)) return false;
  if (tieneMarcaInterna(evento.descripcion)) return false;
  if (tieneMarcaInterna(evento.usuario)) return false;
  return true;
}

/** Filtra una lista de eventos dejando sólo los hitos visibles al cliente. */
export function filtrarEventosVisiblesCliente<T extends EventoVisibleLike>(
  eventos: readonly T[],
): T[] {
  return eventos.filter(esEventoVisibleCliente);
}
