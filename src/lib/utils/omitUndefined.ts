/**
 * Helper genérico tipado para filtrar propiedades `undefined` de un objeto.
 *
 * Usado en lugar de `obj as unknown as Record<string, unknown>` cuando se
 * necesita iterar dinámicamente las claves manteniendo el tipo de retorno.
 */
export function omitUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      out[key] = obj[key];
    }
  }
  return out;
}
