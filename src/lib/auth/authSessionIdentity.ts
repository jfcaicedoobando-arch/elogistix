/** Read only non-secret session identity; never retain or log the token.
 * This claim partitions a cache, not authorization (the server still validates it).
 */
export function readAuthSessionIdentity(accessToken: string | undefined): string | null {
  try {
    const encoded = accessToken?.split(".")[1];
    if (!encoded) return null;
    const payload: unknown = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload || typeof payload !== "object" || !("session_id" in payload)) return null;
    const id = payload.session_id;
    return typeof id === "string" && id.length > 0 && id.length <= 128 ? id : null;
  } catch { return null; }
}
