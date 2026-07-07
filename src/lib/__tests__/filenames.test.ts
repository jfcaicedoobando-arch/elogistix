import { describe, it, expect, vi, beforeEach } from "vitest";
import { slugifyOrg, getOrgFilenameSlug, withOrgPrefix } from "@/lib/filenames";

vi.mock("@/features/configuracion/services", () => ({
  fetchEmisorEmpresa: vi.fn(),
}));

import { fetchEmisorEmpresa } from "@/features/configuracion/services";

describe("slugifyOrg", () => {
  it("quita acentos y convierte espacios a guion bajo", () => {
    expect(slugifyOrg("Logística Móvil S.A.")).toBe("Logistica_Movil_S_A");
  });
  it("cae a 'org' cuando el nombre es vacío o nulo", () => {
    expect(slugifyOrg(null)).toBe("org");
    expect(slugifyOrg("")).toBe("org");
    expect(slugifyOrg("   ")).toBe("org");
    expect(slugifyOrg("!!!")).toBe("org");
  });
  it("limita el largo a 40 caracteres", () => {
    const largo = "A".repeat(80);
    expect(slugifyOrg(largo).length).toBe(40);
  });
  it("colapsa múltiples símbolos en un solo underscore", () => {
    expect(slugifyOrg("Foo   ---   Bar")).toBe("Foo_Bar");
  });
});

describe("getOrgFilenameSlug / withOrgPrefix", () => {
  beforeEach(() => {
    vi.mocked(fetchEmisorEmpresa).mockReset();
  });

  it("usa razonSocial del emisor", async () => {
    vi.mocked(fetchEmisorEmpresa).mockResolvedValue({
      razonSocial: "Libre Carga",
      subtitulo: "", rfc: "", direccion: "", contacto: "",
    });
    expect(await getOrgFilenameSlug()).toBe("Libre_Carga");
    expect(await withOrgPrefix("A123-cotizacion")).toBe("Libre_Carga_A123-cotizacion");
  });

  it("cae a 'org' si el fetch falla", async () => {
    vi.mocked(fetchEmisorEmpresa).mockRejectedValue(new Error("boom"));
    expect(await getOrgFilenameSlug()).toBe("org");
  });
});
