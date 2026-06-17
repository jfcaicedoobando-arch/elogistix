/**
 * Helpers para resolver texto libre o IDs de puerto/tipo de contenedor
 * contra los catálogos. Extraído de SugerenciasTarifaInline para mantener
 * el componente ≤200 líneas (Power of 10).
 */
const norm = (s: string) =>
  s.toLowerCase().replace(/['"’`()]/g, "").replace(/\s+/g, " ").trim();

export function resolverPuertoId(
  valor: string | undefined | null,
  puertos: Array<{ id: string; name: string; country: string; code: string }>,
): string | undefined {
  if (!valor) return undefined;
  if (puertos.some((p) => p.id === valor)) return valor;
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
