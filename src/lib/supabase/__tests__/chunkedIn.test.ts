import { describe, it, expect, vi } from 'vitest';
import { chunkIds, fetchInChunks, countInChunks, IN_CHUNK_SIZE } from '../chunkedIn';

describe('chunkedIn', () => {
  it('devuelve lotes vacíos cuando no hay ids', () => {
    expect(chunkIds([])).toEqual([]);
  });

  it('deduplica y parte en lotes del tamaño indicado', () => {
    expect(chunkIds(['a', 'b', 'a', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
  });

  it('usa 200 como tamaño por defecto', () => {
    const ids = Array.from({ length: 450 }, (_, i) => `id-${i}`);
    const lotes = chunkIds(ids);
    expect(IN_CHUNK_SIZE).toBe(200);
    expect(lotes.map((l) => l.length)).toEqual([200, 200, 50]);
  });

  it('fetchInChunks concatena filas de cada lote', async () => {
    const fetcher = vi.fn(async (lote: string[]) => lote.map((id) => ({ id })));
    const rows = await fetchInChunks(['a', 'b', 'c'], fetcher, 2);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(rows).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });

  it('fetchInChunks no consulta cuando la lista está vacía', async () => {
    const fetcher = vi.fn();
    expect(await fetchInChunks([], fetcher)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('countInChunks suma los conteos por lote', async () => {
    const counter = vi.fn(async (lote: string[]) => lote.length);
    expect(await countInChunks(['a', 'b', 'c'], counter, 2)).toBe(3);
    expect(counter).toHaveBeenCalledTimes(2);
  });

  it('countInChunks devuelve 0 sin ids', async () => {
    const counter = vi.fn();
    expect(await countInChunks([], counter)).toBe(0);
    expect(counter).not.toHaveBeenCalled();
  });
});
