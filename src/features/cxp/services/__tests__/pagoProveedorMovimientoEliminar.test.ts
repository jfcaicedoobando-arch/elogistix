/**
 * v13.496.0 — Al borrar un pago, el movimiento bancario se da de baja incluso
 * si antes se desvinculó (pago_proveedor_id = NULL): se busca por su huella.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const update = vi.fn();
const or = vi.fn();
const is = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ update: (...a: unknown[]) => update(...a) }),
  },
}));
vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: vi.fn().mockResolvedValue(undefined),
}));

import { eliminarMovimientoBancarioPago } from "../pagoProveedorMovimiento";

describe("eliminarMovimientoBancarioPago", () => {
  beforeEach(() => {
    update.mockReset();
    or.mockReset();
    update.mockReturnValue({ or: (...a: unknown[]) => or(...a) });
    or.mockReturnValue({ is: (...a: unknown[]) => is(...a) });
  });

  it("filtra por pago_proveedor_id o por la huella pago-<id>", async () => {
    await eliminarMovimientoBancarioPago("pago-123", "user-1");
    expect(or).toHaveBeenCalledWith(
      "pago_proveedor_id.eq.pago-123,hash_dedupe.eq.pago-pago-123",
    );
    expect(is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("marca la baja lógica con el usuario que elimina", async () => {
    await eliminarMovimientoBancarioPago("p1", "u9");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_by: "u9", deleted_at: expect.any(String) }),
    );
  });
});
