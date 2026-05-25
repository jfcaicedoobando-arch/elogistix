import { describe, it, expect, vi } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

const mock = createSupabaseMock();
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { actualizarContenedorEmbarque } from "@/services/embarque/contenedor";

describe("actualizarContenedorEmbarque", () => {
  it("ejecuta update().eq sobre embarques sin lanzar cuando no hay error", async () => {
    mock.setTableResult("embarques", { data: null, error: null });
    await expect(
      actualizarContenedorEmbarque("emb-1", "MSCU1234567"),
    ).resolves.toBeUndefined();
    const call = mock.tableCalls.at(-1);
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
