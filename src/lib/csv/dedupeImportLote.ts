/**
 * Defecto 4 (ronda posterior a v13.823.39): prevalidación de duplicados para
 * importaciones masivas.
 *
 * Analogía: antes de meter fichas nuevas al archivero, se revisa si la ficha ya
 * está. Así, si el usuario vuelve a subir el mismo CSV (por ejemplo porque un
 * lote falló a la mitad), las filas ya guardadas se omiten en vez de
 * duplicarse, y el diálogo puede decir cuántas se omitieron.
 */
import { normalizarRazonSocial } from "@/lib/text/razonSocial";

/**
 * Clave de identidad de una contraparte: el RFC cuando existe (identificador
 * fiscal único por organización) y, si no, la razón social normalizada.
 */
export function claveImport(nombre: string, rfc?: string | null): string {
  const rfcLimpio = (rfc ?? "").trim().toUpperCase();
  if (rfcLimpio !== "") return `rfc:${rfcLimpio}`;
  return `nombre:${normalizarRazonSocial(nombre).toLowerCase()}`;
}

export interface SeparacionDuplicados<T> {
  /** Filas a insertar (sin duplicados internos ni ya existentes en la base). */
  unicos: T[];
  /** Filas omitidas por duplicado (dentro del archivo o ya en la base). */
  omitidos: T[];
}

/**
 * Separa las filas en las que se pueden insertar y las duplicadas, mirando
 * tanto las claves ya existentes en la base como las repetidas en el archivo.
 */
export function separarDuplicados<T>(
  items: readonly T[],
  claveDe: (item: T) => string,
  yaExistentes: ReadonlySet<string>,
): SeparacionDuplicados<T> {
  const vistos = new Set<string>();
  const unicos: T[] = [];
  const omitidos: T[] = [];
  for (const item of items) {
    const clave = claveDe(item);
    if (yaExistentes.has(clave) || vistos.has(clave)) {
      omitidos.push(item);
      continue;
    }
    vistos.add(clave);
    unicos.push(item);
  }
  return { unicos, omitidos };
}

/** Divide un arreglo en trozos para no exceder el tope de `in(...)`. */
export function enTrozos<T>(items: readonly T[], tamano = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) out.push(items.slice(i, i + tamano));
  return out;
}

/** Resultado uniforme de una importación por lotes. */
export interface ResultadoImportLote<T> {
  creados: T[];
  /** Filas omitidas por ya existir o repetirse en el archivo. */
  omitidos: number;
}
