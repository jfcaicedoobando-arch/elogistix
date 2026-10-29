import { describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { guardarMargenMinimo } from "../margenMinimo";

describe("guardarMargenMinimo", () => {
  it("delega el porcentaje al RPC sin escribir configuración directamente", async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await guardarMargenMinimo(8.5);
    expect(rpc).toHaveBeenCalledWith("set_margen_minimo_utilidad", { p_pct: 8.5 });
  });
  it("propaga la denegación del RPC sin ocultarla", async () => {
    const error = { code: "42501", message: "denied" };
    rpc.mockResolvedValueOnce({ error });
    await expect(guardarMargenMinimo(5)).rejects.toBe(error);
  });
});
