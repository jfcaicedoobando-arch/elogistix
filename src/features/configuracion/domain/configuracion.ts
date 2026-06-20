/**
 * Lógica de dominio pura para configuración por organización.
 */
export interface ConfigItemLike {
  categoria: string;
}

export function agruparConfigPorCategoria<T extends ConfigItemLike>(
  items: T[],
): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {});
}
