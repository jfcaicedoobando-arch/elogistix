/**
 * Helpers para resolver texto libre o IDs de puerto/tipo de contenedor
 * contra los catálogos. Extraído de SugerenciasTarifaInline para mantener
 * el componente ≤200 líneas (Power of 10).
 */
const norm = (s: string) =>
  s.toLowerCase().replace(/['"’`()]/g, "").replace(/\s+/g, " ").trim();

/**
 * CRM-P2.5: el CRM guarda rutas puerta a puerta en un solo texto
 * ("Puerto de Manzanillo → Parque Industrial Apodaca"). Para buscar tarifa hay
 * que resolver el PUERTO sin sobrescribir el destino final que ve el cliente:
 * se prueban los segmentos del texto (y sin el prefijo "Puerto de").
 */
export function segmentosRuta(valor: string): string[] {
  const partes = valor
    .split(/→|->|=>|\||\/|;/)
    .map((p) => p.trim())
    .filter(Boolean);
  const base = partes.length > 0 ? partes : [valor];
  const sinPrefijo = base
    .map((p) => p.replace(/^(puerto|aeropuerto|terminal)\s+(de|del)\s+/i, "").trim())
    .filter(Boolean);
  return [...new Set([...base, ...sinPrefijo])];
}

type PuertoCatalogo = { id: string; name: string; country: string; code: string };

/**
 * Etapa 3 — resolución INEQUÍVOCA. Sólo se acepta: ID directo, UN/LOCODE
 * exacto, etiqueta completa exacta o nombre exacto ÚNICO. Antes se aceptaba el
 * "primer match" por prefijo y dos puertos homónimos (p. ej. dos "Santos")
 * podían resolverse al equivocado. Ante 0 o más de 1 coincidencias: undefined.
 */
export function resolverPuertoId(
  valor: string | undefined | null,
  puertos: PuertoCatalogo[],
): string | undefined {
  if (!valor) return undefined;
  if (puertos.some((p) => p.id === valor)) return valor;
  for (const segmento of segmentosRuta(valor)) {
    const ids = idsCandidatos(segmento, puertos);
    if (ids.length === 1) return ids[0];
    // Ambiguo: no se adivina. Tampoco se prueban segmentos posteriores con un
    // resultado ya contradictorio.
    if (ids.length > 1) return undefined;
  }
  return undefined;
}

function idsCandidatos(valor: string, puertos: PuertoCatalogo[]): string[] {
  const objetivo = norm(valor);
  if (!objetivo) return [];
  const niveles: Array<(p: PuertoCatalogo) => string> = [
    (p) => p.code,
    (p) => `${p.name}, ${p.country} (${p.code})`,
    (p) => `${p.name}, ${p.country}`,
    (p) => p.name,
  ];
  for (const etiqueta of niveles) {
    const ids = puertos.filter((p) => norm(etiqueta(p)) === objetivo).map((p) => p.id);
    if (ids.length > 0) return ids;
  }
  return [];
}


export function resolverTipoId(
  valor: string | undefined | null,
  tipos: Array<{ id: string; name: string }>,
): string | undefined {
  if (!valor) return undefined;
  if (tipos.some((t) => t.id === valor)) return valor;
  const objetivo = norm(valor);
  return tipos.find((t) => norm(t.name) === objetivo)?.id;
}
