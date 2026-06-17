/**
 * Fase 3 — bootstrapQueryPersister es idempotente (no re-inicia el persister).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const persistSpy = vi.fn();
vi.mock("@tanstack/react-query-persist-client", () => ({
  persistQueryClient: (...args: unknown[]) => persistSpy(...args),
}));

import { bootstrapQueryPersister } from "../persistBootstrap";
import type { QueryClient } from "@tanstack/react-query";

describe("bootstrapQueryPersister", () => {
  beforeEach(() => persistSpy.mockClear());

  it("inicializa persistQueryClient una única vez aunque se invoque N veces", async () => {
    const fakeClient = {} as QueryClient;
    await bootstrapQueryPersister(fakeClient);
    await bootstrapQueryPersister(fakeClient);
    await bootstrapQueryPersister(fakeClient);
    expect(persistSpy).toHaveBeenCalledTimes(1);
  });
});
