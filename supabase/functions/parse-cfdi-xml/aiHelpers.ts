/**
 * Helpers puros para parse-cfdi-xml: armado de prompt, fallback y parsing
 * del tool-call response. Aislados del handler para tests sin red ni Deno.
 */

export interface Categoria { id: string; nombre: string }
export interface Concepto { descripcion: string }

export interface AiSugerencia {
  categoria_id: string | null;
  notas: string;
}

/**
 * Resultado por defecto cuando la AI se salta (sin categorías o sin
 * conceptos). Concatena descripciones separadas por "; " y recorta a 240.
 */
export function fallbackResult(conceptos: Concepto[]): AiSugerencia {
  return {
    categoria_id: null,
    notas: conceptos.map(c => c.descripcion).join("; ").slice(0, 240),
  };
}

/**
 * Parsea la respuesta del AI Gateway extrayendo el primer tool_call.
 * Devuelve `null` si el JSON es inválido o no hay tool_calls.
 * Valida que `categoria_id` exista en el catálogo recibido.
 */
export function parseToolCallResponse(j: unknown, categorias: Categoria[]): AiSugerencia | null {
  const args = (j as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }> })
    .choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try {
    const parsed = JSON.parse(args);
    const id = String(parsed.categoria_id ?? "").trim();
    const valid = categorias.some(c => c.id === id);
    return { categoria_id: valid ? id : null, notas: String(parsed.notas ?? "").slice(0, 240) };
  } catch {
    return null;
  }
}

/**
 * Filtra y limita el catálogo de categorías recibido como JSON crudo.
 * Acepta sólo entradas con `id` y `nombre` string. Máx 50 entradas.
 */
export function parseCategoriasJson(raw: string | null): Categoria[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c) => c && typeof c.id === "string" && typeof c.nombre === "string")
      .slice(0, 50);
  } catch {
    return [];
  }
}
