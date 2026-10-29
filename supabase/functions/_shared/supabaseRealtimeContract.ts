/** An in-memory WebSocket surface; it never constructs a real socket. */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

export type RealtimeFrame = [string | null, string | null, string, string, {
  access_token?: string;
  config?: { private?: boolean; postgres_changes?: unknown };
  [key: string]: unknown;
}];

export function fakeRealtimeTransport() {
  const sockets: FixtureWebSocket[] = [];
  class FixtureWebSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    CONNECTING = 0;
    OPEN = 1;
    CLOSING = 2;
    CLOSED = 3;
    readyState = 0;
    bufferedAmount = 0;
    binaryType = "arraybuffer";
    url: string;
    protocol: string;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    sent: RealtimeFrame[] = [];
    closeCalls = 0;
    constructor(address: string | URL, protocols?: string | string[]) {
      super();
      assertEquals(arguments.length, 2);
      this.url = String(address);
      this.protocol = typeof protocols === "string" ? protocols : protocols?.[0] ?? "";
      sockets.push(this);
    }
    open() {
      this.readyState = this.OPEN;
      this.onopen?.(new Event("open"));
    }
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      assertEquals(this.readyState, this.OPEN);
      if (typeof data !== "string") throw new Error("This fixture only expects join/auth/leave JSON frames");
      const frame = JSON.parse(data);
      assertEquals(Array.isArray(frame) && frame.length === 5, true);
      this.sent.push(frame);
    }
    receive(frame: RealtimeFrame) {
      this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(frame) }));
    }
    reply(frame: RealtimeFrame, response: unknown = {}) {
      this.receive([frame[0], frame[1], frame[2], "phx_reply", { status: "ok", response }]);
    }
    close(code = 1000, reason = "") {
      this.closeCalls += 1;
      this.readyState = this.CLOSED;
      this.onclose?.(new CloseEvent("close", { code, reason, wasClean: true }));
    }
  }
  return { sockets, FixtureWebSocket };
}

export async function settleRealtime() {
  for (let turn = 0; turn < 12; turn++) await Promise.resolve();
}
