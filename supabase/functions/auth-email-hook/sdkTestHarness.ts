import assert from "node:assert/strict";

type Handler = (request: Request) => Response | Promise<Response>;
type Send = { url: string; headers: Headers; body: Record<string, unknown> };

export const API_KEY = "offline-auth-sdk-test-key";
const SEND_URL = "https://email-sdk.invalid/send";
export const ACTIONS = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "reauthentication",
] as const;
export const EMAIL = "recipient@example.test";
export const CONFIRM_URL =
  "https://app.example.test/confirm?token=offline-token";
export const TOKEN = "741852";
let adapter: Handler | undefined;

export function event(action: string, runId = `offline-${action}`) {
  return {
    version: "1",
    type: "auth",
    run_id: runId,
    data: {
      action_type: action,
      email: EMAIL,
      url: CONFIRM_URL,
      token: TOKEN,
      old_email: "old@example.test",
      new_email: "new@example.test",
    },
  };
}

export async function signedRequest(
  payload: unknown,
  options: {
    timestamp?: string;
    secret?: string;
    signature?: string;
    headers?: HeadersInit;
  } = {},
): Promise<Request> {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(options.secret ?? API_KEY),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${body}`),
  );
  const hex = Array.from(
    new Uint8Array(signature),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  return new Request("https://auth-hook.invalid", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-lovable-timestamp": timestamp,
      "x-lovable-signature": options.signature ?? `sha256=${hex}`,
      ...options.headers,
    },
    body,
  });
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** Exercise the deployed adapter without listening, credentials, or real fetch. */
export async function isolated(
  run: (handle: Handler, sends: Send[]) => Promise<void>,
  sendResponse: () => Response | Promise<Response> = () =>
    Response.json({ message_id: "offline-message" }),
): Promise<void> {
  const originalEnvGet = Deno.env.get;
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  const sends: Send[] = [];
  const unexpectedDestinations: string[] = [];
  Reflect.set(Deno.env, "get", (name: string) => {
    if (name === "LOVABLE_API_KEY") return API_KEY;
    if (name === "LOVABLE_SEND_URL") return SEND_URL;
    if (name === "NODE_ENV") return "test";
    throw new Error(`Unexpected environment lookup: ${name}`);
  });
  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== SEND_URL) unexpectedDestinations.push(url);
    assert.equal(
      url,
      SEND_URL,
      "unexpected fetch destination; real network is forbidden",
    );
    assert.equal(init?.method, "POST");
    sends.push({
      url,
      headers: new Headers(init.headers),
      body: JSON.parse(String(init.body)),
    });
    return await sendResponse();
  };
  try {
    if (!adapter) {
      Reflect.set(Deno, "serve", (handler: Handler) => {
        assert.equal(typeof handler, "function");
        adapter = handler;
      });
      await import("./index.ts");
      Reflect.set(Deno, "serve", originalServe);
    }
    assert.ok(adapter, "the real adapter must register a request handler");
    await run(adapter, sends);
    assert.deepEqual(unexpectedDestinations, []);
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.set(Deno, "serve", originalServe);
    Reflect.set(Deno.env, "get", originalEnvGet);
  }
}
