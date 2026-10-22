/** Sentry JAVASCRIPT-REACT-86: nombre de documento repetido es regla de negocio. */
import { describe, it, expect, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/storage/index", () => ({ uploadFile: vi.fn(), deleteFile: vi.fn() }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));

import { createDocumentoEmbarqueRow } from "@/features/embarques/services/documentos";

describe("createDocumentoEmbarqueRow", () => {
  it("nombre repetido da mensaje en español y no se manda a Sentry", async () => {
    mock.setTableResult("documentos_embarque", {
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "documentos_embarque_unico_por_nombre"' },
    });
    const err = await createDocumentoEmbarqueRow({ embarqueId: "e1", nombre: "BL Master" }).catch((e) => e);
    expect(err.name).toBe("ReglaNegocioError");
    expect(err.expected).toBe(true);
    expect(err.message).toContain("«BL Master»");
  });
  it("otros errores se propagan igual", async () => {
    mock.setTableResult("documentos_embarque", { data: null, error: { code: "42501", message: "rls" } });
    const err = await createDocumentoEmbarqueRow({ embarqueId: "e1", nombre: "X" }).catch((e) => e);
    expect(err.name).not.toBe("ReglaNegocioError");
  });
});
