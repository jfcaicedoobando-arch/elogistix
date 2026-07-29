/**
 * M12 (auditoría 2026-07-29, S6-04/05): mapeo async con concurrencia limitada
 * y progreso. Mismo criterio que crm/services/leads/bulk.ts (tandas +
 * Promise.allSettled) — sin dependencia nueva.
 */
export interface MapWithConcurrencyResult<T, R> {
  ok: { item: T; value: R }[];
  errores: { item: T; error: unknown }[];
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrencia: number,
  fn: (item: T) => Promise<R>,
  onProgress?: (completadas: number, total: number) => void,
): Promise<MapWithConcurrencyResult<T, R>> {
  const ok: { item: T; value: R }[] = [];
  const errores: { item: T; error: unknown }[] = [];
  const tamano = Math.max(1, Math.floor(concurrencia));
  let completadas = 0;

  for (let i = 0; i < items.length; i += tamano) {
    const tanda = items.slice(i, i + tamano);
    const resultados = await Promise.allSettled(tanda.map((item) => fn(item)));
    resultados.forEach((r, j) => {
      if (r.status === "fulfilled") ok.push({ item: tanda[j], value: r.value });
      else errores.push({ item: tanda[j], error: r.reason });
    });
    completadas += tanda.length;
    onProgress?.(completadas, items.length);
  }

  return { ok, errores };
}
