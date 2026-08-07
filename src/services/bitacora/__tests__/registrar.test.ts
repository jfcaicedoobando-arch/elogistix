import { describe, it, expect, beforeEach, vi } from "vitest";
import { registrarActividad, MODULOS_BITACORA } from "../registrar";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ insert });
  const session = { data: { session: { user: { id: "u-1", email: "a@b.com" } } } };
  const getSession = vi.fn().mockResolvedValue(session);
  return { supabase: { from, auth: { getSession } } };
});

describe("registrarActividad", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserta usando el shape correcto de columnas", async () => {
    await registrarActividad({
      modulo: "cxp",
      accion: "crear",
      entidadId: "fp-1",
      entidadNombre: "FP-000001",
      detalles: { total: 100 },
    });
    // SAFE-CAST: mock devuelve encadenables tipados internamente.
    const insertCall = (supabase.from as unknown as { mock: { results: Array<{ value: { insert: { mock: { calls: unknown[][] } } } }> } })
      .mock.results[0].value.insert.mock.calls[0][0];
    expect(insertCall).toMatchObject({
      usuario_id: "u-1",
      usuario_email: "a@b.com",
      modulo: "cxp",
      accion: "crear",
      entidad_id: "fp-1",
      entidad_nombre: "FP-000001",
    });
  });

  it("no lanza si supabase falla", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({ insert: insertMock });
    await expect(
      registrarActividad({ modulo: "cxp", accion: "crear" }),
    ).resolves.toBeUndefined();
  });

  it("expone el catálogo público de módulos", () => {
    const valores = MODULOS_BITACORA.map((m) => m.valor);
    expect(valores).toContain("cxp");
    expect(valores).toContain("costeo");
    expect(valores).toContain("facturacion");
  });
});
