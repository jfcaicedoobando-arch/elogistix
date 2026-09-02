/**
 * Normalización y deduplicación del catálogo de tipos de contenedor.
 *
 * Bug de producción (P1, 2026-09-02): la organización tenía dos registros
 * visualmente idénticos ("20' Dry (Standard)" y "40' Dry (Standard)") con IDs
 * distintos. Los selectores mostraban dos opciones iguales y, al elegir la
 * segunda, el Top 3 devolvía "No hay tarifas vigentes" aunque la tarifa existía
 * bajo el otro ID.
 *
 * Analogía: dos credenciales de la misma persona. En vez de tirar una (perder
 * datos), la mostramos una sola vez y aceptamos ambas al buscar.
 *
 * Reglas:
 * - La clave canónica es `tamaño|categoría` (p.ej. `20|dry`). Si no se puede
 *   inferir tamaño + categoría, la clave es el nombre normalizado, así los
 *   tipos realmente distintos NUNCA se mezclan.
 * - El ID canónico es determinista: `created_at` más antiguo y, a empate, el ID
 *   menor lexicográficamente. El orden en que llegan las filas no lo cambia.
 * - Cada opción conserva `idsEquivalentes` (todos los IDs del grupo, ordenados)
 *   para que las búsquedas resuelvan tarifas atadas a cualquiera de ellos.
 */
import type { TipoContenedor } from "@/features/catalogos/services/catalogosTypes";

function normalizarTexto(v: string | null | undefined): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const CATEGORIAS: ReadonlyArray<[RegExp, string]> = [
  [/\b(reefer|refrigerad\w*|rf)\b/, "reefer"],
  [/\b(high cube|highcube|hc|hq)\b/, "hc"],
  [/\b(open top|opentop|ot)\b/, "opentop"],
  [/\b(flat rack|flatrack|fr)\b/, "flatrack"],
  [/\b(iso tank|tank|tanque)\b/, "tank"],
  [/\b(platform|plataforma)\b/, "platform"],
  [/\b(dry|standard|std|estandar|st|dv|gp)\b/, "dry"],
];

/** Clave semántica canónica de un tipo de contenedor (tamaño + categoría). */
export function claveCanonicaTipoContenedor(t: Pick<TipoContenedor, "code" | "name">): string {
  const texto = `${normalizarTexto(t.name)} ${normalizarTexto(t.code)}`.trim();
  // Los códigos tipo "40HC"/"20ST" vienen pegados: separa dígitos de letras.
  const separado = texto.replace(/(\d+)([a-z]+)/g, "$1 $2").replace(/([a-z]+)(\d+)/g, "$1 $2");
  const tamano = separado.match(/\b(20|40|45|53)\b/)?.[1];
  const categoria = CATEGORIAS.find(([re]) => re.test(separado))?.[1];
  if (tamano && categoria) return `${tamano}|${categoria}`;
  return `raw:${normalizarTexto(t.name) || normalizarTexto(t.code)}`;
}

export interface TipoContenedorCanonico extends TipoContenedor {
  /** Todos los IDs equivalentes del grupo (incluye el canónico), ordenados. */
  idsEquivalentes: string[];
}

function esMasCanonico(a: TipoContenedor, b: TipoContenedor): boolean {
  const ca = a.created_at ?? "";
  const cb = b.created_at ?? "";
  if (ca !== cb) return ca < cb;
  return a.id < b.id;
}

/**
 * Colapsa duplicados semánticos: devuelve una sola opción por clave canónica,
 * con el ID canónico determinista y la lista de IDs equivalentes.
 */
export function dedupeTiposContenedor(
  rows: ReadonlyArray<TipoContenedor>,
): TipoContenedorCanonico[] {
  const grupos = new Map<string, TipoContenedor[]>();
  for (const r of rows) {
    const clave = claveCanonicaTipoContenedor(r);
    const actual = grupos.get(clave);
    if (actual) actual.push(r);
    else grupos.set(clave, [r]);
  }

  const salida: TipoContenedorCanonico[] = [];
  for (const grupo of grupos.values()) {
    const canonico = grupo.reduce((mejor, r) => (esMasCanonico(r, mejor) ? r : mejor), grupo[0]);
    salida.push({
      ...canonico,
      idsEquivalentes: grupo.map((r) => r.id).sort(),
    });
  }
  // Orden estable por nombre (igual que el `order("name")` del servicio).
  return salida.sort((a, b) => a.name.localeCompare(b.name, "es-MX"));
}

/**
 * IDs equivalentes de un tipo dado (o `[id]` si no está en el catálogo).
 * Sirve para buscar tarifas atadas a cualquiera de los registros legacy.
 */
export function idsEquivalentesDeTipo(
  catalogo: ReadonlyArray<TipoContenedorCanonico>,
  id: string | null | undefined,
): string[] {
  if (!id) return [];
  const match = catalogo.find((t) => t.idsEquivalentes.includes(id));
  return match ? [...match.idsEquivalentes] : [id];
}

/** Resuelve cualquier ID equivalente (legacy) al ID canónico del catálogo. */
export function resolverIdCanonicoTipo(
  catalogo: ReadonlyArray<TipoContenedorCanonico>,
  id: string | null | undefined,
): string {
  if (!id) return "";
  return catalogo.find((t) => t.idsEquivalentes.includes(id))?.id ?? id;
}
