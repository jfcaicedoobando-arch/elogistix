import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";
import { actualizarSolicitud, crearSolicitud } from "../pricingCrm";

const db = vi.hoisted(() => ({ mock: null as ReturnType<typeof createSupabaseMock> | null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (tabla: string) => db.mock?.from(tabla) } }));

describe("persistencia de unidad de peso Pricing", () => {
  beforeEach(() => {
    db.mock = createSupabaseMock();
    db.mock.setTableResult("crm_solicitudes_pricing", { data: { id: "s1", unidad_medida: "kg" }, error: null });
  });

  it("incluye la unidad al guardar un borrador", async () => {
    const solicitud = await crearSolicitud({ folio: "", organization_id: "org1", oportunidad_id: "o1", solicitante_id: "u1", peso: "100", unidad_medida: "kg" });
    expect(solicitud.unidad_medida).toBe("kg");
    const llamada = db.mock?.tableCalls[0];
    expect(llamada?.opArgs[llamada.ops.indexOf("insert")]).toEqual([expect.objectContaining({ peso: "100", unidad_medida: "kg" })]);
  });

  it("conserva la unidad al editar y permite borrarla", async () => {
    await actualizarSolicitud("s1", { unidad_medida: "lb" });
    await actualizarSolicitud("s1", { unidad_medida: null });
    for (const [index, unidad] of ["lb", null].entries()) {
      const llamada = db.mock?.tableCalls[index];
      expect(llamada?.opArgs[llamada.ops.indexOf("update")]).toEqual([{ unidad_medida: unidad }]);
    }
  });
});