import { describe, it, expect, vi, beforeEach } from "vitest";
import { solicitarCotizacionPortal } from "../solicitudes";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

const input = {
  clienteId: "cli-1",
  modo: "Marítimo" as const,
  tipo: "Importación" as const,
  origen: " Shanghái ",
  destino: "Manzanillo",
  tipoEmbarque: "FCL",
};

describe("solicitarCotizacionPortal", () => {
  beforeEach(() => rpc.mockReset());

  it("devuelve el folio generado por la RPC", async () => {
    rpc.mockResolvedValue({ data: [{ id: "cot-1", folio: "COT-2026-0001" }], error: null });
    await expect(solicitarCotizacionPortal(input)).resolves.toEqual({
      id: "cot-1",
      folio: "COT-2026-0001",
    });
    expect(rpc).toHaveBeenCalledWith("portal_solicitar_cotizacion", expect.objectContaining({
      p_cliente_id: "cli-1",
      p_destino: "Manzanillo",
    }));
  });

  it("propaga el error de la base", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "LC_CLIENTE_NO_VINCULADO" } });
    await expect(solicitarCotizacionPortal(input)).rejects.toThrow("LC_CLIENTE_NO_VINCULADO");
  });

  it("falla si la RPC no devuelve filas", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(solicitarCotizacionPortal(input)).rejects.toThrow(/solicitud/i);
  });
});
