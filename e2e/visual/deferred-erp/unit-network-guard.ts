import { beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.stubGlobal("fetch", () => { throw new Error("External fetch forbidden in deferred ERP local suites"); });
  vi.stubGlobal("WebSocket", class { constructor() { throw new Error("WebSocket forbidden in local suites"); } });
});
