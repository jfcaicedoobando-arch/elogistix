import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  registrarAnticipo, 
  aplicarAnticipo, 
  cancelarAnticipo 
} from "../services/anticiposProveedorService";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

const VALID_UUID = "00000000-0000-0000-0000-000000000000";

describe("AnticiposProveedor Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registrarAnticipo llama a la RPC correcta", async () => {
    const mockData = { id: VALID_UUID, monto: 100 };
    (supabase.rpc as any).mockResolvedValueOnce({ data: mockData, error: null });

    const result = await registrarAnticipo({
      proveedorId: VALID_UUID,
      monto: 100,
      moneda: "MXN"
    });

    expect(supabase.rpc).toHaveBeenCalledWith("registrar_anticipo_proveedor", expect.any(Object));
    expect(result).toEqual(mockData);
  });

  it("aplicarAnticipo valida monto positivo", async () => {
    await expect(aplicarAnticipo(VALID_UUID, VALID_UUID, -10)).rejects.toThrow(/monto/i);
  });

  it("cancelarAnticipo requiere motivo mínimo", async () => {
    await expect(cancelarAnticipo(VALID_UUID, "no")).rejects.toThrow(/motivo/i);
  });
});
