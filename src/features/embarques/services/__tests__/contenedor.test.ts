import { describe, it, expect, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { actualizarContenedorEmbarque } from "@/features/embarques/services/contenedor";

describe("actualizarContenedorEmbarque", () => {
  it("ejecuta update().eq sobre embarques sin lanzar cuando no hay error", async () => {
    mock.setTableResult("embarques", { data: null, error: null });
    await expect(
      actualizarContenedorEmbarque("emb-1", "MSCU1234567"),
    ).resolves.toBeUndefined();
    // La bitácora escribe después: buscamos la escritura al embarque.
    const call = [...mock.tableCalls].reverse().find((c) => c.table === "embarques");
    expect(call?.table).toBe("embarques");
    expect(call?.ops).toEqual(expect.arrayContaining(["update", "eq"]));
  });

  it("propaga el error de supabase", async () => {
    mock.setTableResult("embarques", { data: null, error: new Error("rls") });
    await expect(
      actualizarContenedorEmbarque("emb-1", "X"),
    ).rejects.toThrow("rls");
  });
});
