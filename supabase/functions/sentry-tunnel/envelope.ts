/** Binary envelopes must never round-trip through a UTF-8 string. */
export const MAX_ENVELOPE_BYTES = 1_048_576;
const MAX_HEADER_BYTES = 8192;

export function excedeContentLength(req: Request): boolean {
  const len = Number(req.headers.get("content-length") ?? 0);
  return Number.isFinite(len) && len > MAX_ENVELOPE_BYTES;
}

export async function leerEnvelopeAcotado(req: Request): Promise<Uint8Array | null> {
  if (excedeContentLength(req)) return null;
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_ENVELOPE_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export function parseEnvelopeDsn(firstLine: string): { host: string; projectId: string } | null {
  try {
    const header = JSON.parse(firstLine);
    if (typeof header.dsn !== "string") return null;
    const url = new URL(header.dsn);
    const projectId = url.pathname.replace(/^\/+/, "").split("/")[0];
    if (url.protocol !== "https:" || !/^\d+$/.test(projectId)) return null;
    return { host: url.host, projectId };
  } catch {
    return null;
  }
}

export function readEnvelopeDestination(bytes: Uint8Array): ReturnType<typeof parseEnvelopeDsn> {
  const newline = bytes.indexOf(10);
  if (newline < 0 || newline > MAX_HEADER_BYTES) return null;
  return parseEnvelopeDsn(new TextDecoder().decode(bytes.subarray(0, newline)));
}
