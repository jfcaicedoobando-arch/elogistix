/** Test-only transport: the real SDK never receives the network fetch function. */
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
export { createClient };

export const SDK_URL = "https://sdk-contract.invalid";
export const SDK_KEY = "contract-key";
export const USER_ID = "abcdefab-cdef-4abc-8def-abcdefabcdef";
export const FACTOR_ID = "fedcbafe-dcba-4fed-8cba-fedcbafedcba";

/** Imports are cached before tests; no SDK fallback may use CI's --allow-net. */
export function offlineTest(name: string, fn: () => Promise<void>): void {
  Deno.test({ name, permissions: { net: false }, fn });
}

export interface SdkRequest {
  url: URL;
  method: string;
  headers: Headers;
  body: string;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function sdkFixture(
  response: (request: SdkRequest) => Response,
  headers: Record<string, string> = {},
) {
  const requests: SdkRequest[] = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const captured = {
      url: new URL(request.url),
      method: request.method,
      headers: request.headers,
      body: await request.text(),
    };
    requests.push(captured);
    return response(captured);
  };
  const client = createClient(SDK_URL, SDK_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fakeFetch, headers },
  });
  return { client, requests };
}
