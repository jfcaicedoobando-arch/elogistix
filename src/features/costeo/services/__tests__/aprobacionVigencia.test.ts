/**
 * Guard de aprobación en la capa de servicio: la vigencia se relee por id
 * (la fila de la UI puede estar obsoleta) y una lectura fallida NO aprueba.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const single = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({ select: () => ({ eq: () => ({ single: () => single() }) }) }),
  },
}));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));
vi.mock("@/lib/date/today", () => ({ todayLocalISO: () => "2026-09-01" }));

import { aprobarTarifaVerificada } from "../aprobacion";

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  single.mockReset();
});

describe("aprobarTarifaVerificada", () => {
  it("bloquea cuando la vigencia canónica de la base ya venció", async () => {
    single.mockResolvedValue({ data: { vigente_hasta: "2026-08-31" }, error: null });
    await expect(aprobarTarifaVerificada("t1")).rejects.toThrow(/vigencia vencida/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("no aprueba si falla la lectura de la vigencia", async () => {
    single.mockResolvedValue({ data: null, error: { message: "network" } });
    await expect(aprobarTarifaVerificada("t1")).rejects.toMatchObject({ message: "network" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("aprueba cuando la base dice que sigue vigente", async () => {
    single.mockResolvedValue({ data: { vigente_hasta: "2026-12-31" }, error: null });
    await aprobarTarifaVerificada("t1");
    expect(rpc).toHaveBeenCalledWith("agente_aprobar_tarifa", expect.objectContaining({ _tarifa_id: "t1" }));
  });

  it("aprueba cuando vence hoy (frontera)", async () => {
    single.mockResolvedValue({ data: { vigente_hasta: "2026-09-01" }, error: null });
    await aprobarTarifaVerificada("t1");
    expect(rpc).toHaveBeenCalled();
  });
});
