/**
 * Decodifica entidades HTML básicas en strings provenientes de datos legacy
 * (por ejemplo, RFCs guardados como "AL&amp;0807074L5" en vez de "AL&0807074L5").
 *
 * Aplicable a strings mostrados al usuario. No usar sobre HTML confiable
 * para renderizar; solo para display de texto plano.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeHtmlEntities(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith("#x")) {
      const cp = parseInt(lower.slice(2), 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
    }
    if (lower.startsWith("#")) {
      const cp = parseInt(lower.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : match;
    }
    return NAMED_ENTITIES[lower] ?? match;
  });
}
