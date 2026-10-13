import { chunkIds, fetchInChunks, IN_CHUNK_SIZE } from "@/lib/supabase/chunkedIn";

/** Limit the fan-out of each projection source, including very large months. */
export async function fetchProjectionInChunks<T>(
  ids: readonly string[],
  fetcher: (ids: string[]) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  for (const batch of chunkIds(ids, IN_CHUNK_SIZE * 3)) {
    rows.push(...await fetchInChunks(batch, fetcher));
  }
  return rows;
}
