import { beforeEach, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({ crear: vi.fn(), persistir: vi.fn(), vincular: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: vi.fn((table: string) => {
    const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.in.mockResolvedValue({ data: table === "conceptos_costo"
      ? [{ id: "c1", concepto: "Flete", moneda: "MXN", monto: 20.44 }] : [], error: null });
    return query;
  }),
  rpc: vi.fn(() => { throw new Error("RPC no permitido en esta prueba local"); }),
} }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: io.notifyError, notifySuccess: vi.fn() }));
vi.mock("@/features/cxp/services", () => ({ buscarFacturaDuplicadaFolio: vi.fn().mockResolvedValue(null) }));
vi.mock("../useNuevaFacturaProveedorForm.dup", () => ({
  buscarCfdiDuplicado: vi.fn().mockResolvedValue({ estado: "no_existe" }), describirFacturaExistente: vi.fn(),
}));
vi.mock("../useNuevaFacturaProveedorForm.sideEffects", () => ({
  uploadCfdiSafe: vi.fn(), persistirConceptosCfdiSafe: io.persistir,
  vincularSafe: io.vincular, aprenderAliasProveedorSafe: vi.fn(), buildFacturaSuccessDescription: vi.fn(),
}));
import { runSubmit } from "../useNuevaFacturaProveedorForm.submit";
import { initialValues } from "../useNuevaFacturaProveedorForm.helpers";

beforeEach(() => { vi.clearAllMocks(); io.crear.mockResolvedValue({ id: "f1" }); });

describe("auditoría 133 · guardado sin efectos parciales", () => {
  it("rechaza EUR/MXN antes de crear cabecera, conceptos o vínculos", async () => {
    const result = await runSubmit({
      values: { ...initialValues(), provId: "p1", folio: "REV-EUR", moneda: "EUR", tc: "20.44",
        categoriaId: "cat", subtotal: "1" },
      total: 1, userId: "u1", organizationId: "org", pendingCfdi: null,
      cfdiConceptos: [{ descripcion: "Flete", cantidad: 1, importe: 1, iva: 0, ieps: 0 }],
      vinculos: { c1: { embarqueId: "e1", descripcion: "Flete", monto: 1, montoOriginal: 1, monedaBase: "EUR" } },
      embarqueAdHoc: null, crearMutateAsync: io.crear, setFolioError: vi.fn(),
    });
    expect(result).toEqual({ ok: false, facturaId: null });
    expect(io.crear).not.toHaveBeenCalled();
    expect(io.persistir).not.toHaveBeenCalled();
    expect(io.vincular).not.toHaveBeenCalled();
    expect(io.notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
      description: expect.stringContaining("EUR/MXN"),
    }));
  });
});
