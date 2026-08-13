import { describe, it, expect, beforeEach, vi } from "vitest";

const storage = vi.hoisted(() => ({
  uploadFile: vi.fn(async (_path: string, _file: File) => ({ path: "ok" })),
  getSignedUrl: vi.fn(async () => "https://firmada.example/doc.pdf"),
  deleteFile: vi.fn(async () => undefined),
}));
vi.mock("@/services/storage", () => storage);

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  const m = createSupabaseMock();
  (m.supabase as unknown as Record<string, unknown>).auth = {
    getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
  };
  return m;
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  slugArchivo,
  subirDocumentoProveedor,
  urlDocumentoProveedor,
} from "@/features/proveedor/services/proveedorDocumentos";

beforeEach(() => {
  storage.uploadFile.mockClear();
  storage.deleteFile.mockClear();
  storage.getSignedUrl.mockClear();
});

describe("slugArchivo", () => {
  it("quita acentos y caracteres inseguros", () => {
    expect(slugArchivo("Opinión de cumplimiento (agosto).pdf"))
      .toBe("Opinion-de-cumplimiento-agosto-.pdf");
  });
});

describe("subirDocumentoProveedor", () => {
  const archivo = new File(["contenido"], "csf.pdf", { type: "application/pdf" });

  it("sube el archivo bajo la carpeta del proveedor", async () => {
    await subirDocumentoProveedor({
      proveedorId: "p1",
      organizationId: "o1",
      tipo: "Constancia de situación fiscal",
      archivo,
    }).catch(() => undefined);
    const path = String(storage.uploadFile.mock.calls[0]?.[0] ?? "");
    expect(path.startsWith("proveedores/p1/")).toBe(true);
    expect(path.endsWith("csf.pdf")).toBe(true);
  });

  it("borra el archivo si falla el registro en la base", async () => {
    mock.setTableResult("proveedor_documentos", { data: null, error: { message: "rls" } });
    await expect(
      subirDocumentoProveedor({
        proveedorId: "p1",
        organizationId: "o1",
        tipo: "Contrato",
        archivo,
      }),
    ).rejects.toBeTruthy();
    expect(storage.deleteFile).toHaveBeenCalled();
  });
});

describe("urlDocumentoProveedor", () => {
  it("pide una liga firmada de corta duración", async () => {
    const url = await urlDocumentoProveedor("proveedores/p1/csf.pdf");
    expect(url).toContain("https://");
    expect(storage.getSignedUrl).toHaveBeenCalledWith("proveedores/p1/csf.pdf", 300);
  });
});
