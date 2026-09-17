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

export function resolverPuertoId(
  valor: string | undefined | null,
  puertos: Array<{ id: string; name: string; country: string; code: string }>,
): string | undefined {
  if (!valor) return undefined;
  if (puertos.some((p) => p.id === valor)) return valor;
  for (const segmento of segmentosRuta(valor)) {
    const id = resolverPuertoIdExacto(segmento, puertos);
    if (id) return id;
  }
  return undefined;
}

function resolverPuertoIdExacto(
  valor: string,
  puertos: Array<{ id: string; name: string; country: string; code: string }>,
): string | undefined {
  const objetivo = norm(valor);
  if (!objetivo) return undefined;
  return puertos.find((p) => {
    const candidatos = [
      p.name,
      `${p.name}, ${p.country}`,
      `${p.name}, ${p.country} (${p.code})`,
      p.code,
    ].map(norm);
    return candidatos.some((c) => c === objetivo || objetivo.startsWith(c));
  })?.id;
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
