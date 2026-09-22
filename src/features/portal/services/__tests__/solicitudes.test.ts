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
    expect(rpc).toHaveBeenCalledWith("portal_solicitar_cotizacion_v2", expect.objectContaining({
      p_cliente_id: "cli-1",
      p_destino: "Manzanillo",
    }));
  });

  it("Etapa 5 · envía los IDs de puerto en Marítimo", async () => {
    rpc.mockResolvedValue({ data: [{ id: "cot-1", folio: "COT-1" }], error: null });
    await solicitarCotizacionPortal({ ...input, puertoOrigenId: "p-1", puertoDestinoId: "p-2" });
    expect(rpc).toHaveBeenCalledWith("portal_solicitar_cotizacion_v2", expect.objectContaining({
      p_puerto_origen_id: "p-1",
      p_puerto_destino_id: "p-2",
    }));
  });

  it("Etapa 5 · fuerza IDs nulos fuera de Marítimo", async () => {
    rpc.mockResolvedValue({ data: [{ id: "cot-1", folio: "COT-1" }], error: null });
    await solicitarCotizacionPortal({
      ...input, modo: "Aéreo", puertoOrigenId: "p-1", puertoDestinoId: "p-2",
    });
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_puerto_origen_id).toBeUndefined();
    expect(args.p_puerto_destino_id).toBeUndefined();
  });

  it("Etapa 5 · nunca llama la firma v1", async () => {
    rpc.mockResolvedValue({ data: [{ id: "cot-1", folio: "COT-1" }], error: null });
    await solicitarCotizacionPortal(input);
    expect(rpc).not.toHaveBeenCalledWith("portal_solicitar_cotizacion", expect.anything());
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
