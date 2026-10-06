import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), verify: vi.fn(), suggest: vi.fn(), activity: vi.fn() }));
vi.mock("@/features/cxp/services/facturasEntrantesUploadAlta", () => ({
  subirArchivosDelBuzon: async () => ({ archivoPrincipal: { name: "invoice.xml" }, principal: { path: "saved.xml" }, xmlSubido: null }),
  insertarFilaEntrante: mocks.insert, verificarMetadatosDelAlta: mocks.verify,
}));
vi.mock("@/features/cxp/services/facturasEntrantesConceptos", () => ({ guardarConceptosSugeridos: mocks.suggest }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: mocks.activity }));
vi.mock("@/lib/domain/facturasEntrantes", () => ({ validarParejaEntrante: () => null }));
import { subirFacturaEntranteConResultado } from "../facturasEntrantesUpload";
import type { SubirFacturaEntranteInput } from "../facturasEntrantes.types";

describe("inbox ancillary failures after saved document", () => {
  it("keeps identity when suggestions and XML verification fail", async () => {
    mocks.insert.mockResolvedValue("saved-id");
    mocks.suggest.mockRejectedValue(new Error("network"));
    mocks.verify.mockRejectedValue(new Error("unverified metadata"));
    mocks.activity.mockRejectedValue(new Error("audit unavailable"));
    const result = await subirFacturaEntranteConResultado({ xml: {} } as SubirFacturaEntranteInput);
    expect(result).toEqual({ documentoId: "saved-id", sugerenciasGuardadas: false, verificacionXmlPendiente: true, bitacoraPendiente: true });
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.verify).toHaveBeenCalledTimes(1);
  });
});
