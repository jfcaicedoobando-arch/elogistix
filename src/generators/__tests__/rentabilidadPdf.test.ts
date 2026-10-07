import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/pdf/emisor", () => ({
  cargarEmisorEmpresa: vi.fn(),
}));
vi.mock("@/pdf/render/descargarPdf", () => ({
  descargarPdf: vi.fn(),
}));
vi.mock("@/pdf/documents/RentabilidadDocument", () => ({
  RentabilidadDocument: vi.fn(() => null),
}));

import { generarRentabilidadPdf } from "../rentabilidadPdf";
import { cargarEmisorEmpresa } from "@/pdf/emisor";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";

const mockEmisor = cargarEmisorEmpresa as ReturnType<typeof vi.fn>;
const mockDescargar = descargarPdf as ReturnType<typeof vi.fn>;

const INPUT = {
  organizacion: { id: "org-sintetica", nombre: "Comercial Sintética" },
  fechaDesde: "2024-01-01",
  fechaHasta: "2024-03-31",
  modo: "Marítimo",
  kpis: { total_venta_usd: 100000, total_costo_usd: 60000, total_profit_usd: 40000, margen_promedio: 40 },
  clientes: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  setAuthSnapshot({ userId: "user-sintetico", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "user-sintetico", organizationId: "org-sintetica" });
  mockEmisor.mockResolvedValue({ razonSocial: "Empresa SA" });
  mockDescargar.mockResolvedValue(undefined);
});

describe("generarRentabilidadPdf", () => {
  it("identifica comercialmente el reporte sin cargar ni fabricar datos fiscales", async () => {
    await generarRentabilidadPdf(INPUT);
    expect(mockEmisor).not.toHaveBeenCalled();
    expect(mockDescargar).toHaveBeenCalledOnce();
    const [documento, filename] = mockDescargar.mock.calls[0];
    expect(documento.props.organizacionNombre).toBe("Comercial Sintética");
    expect(documento.props.emisor).toBeUndefined();
    expect(filename).toBe("Comercial_Sintetica_rentabilidad-2024-01-01_2024-03-31");
  });

  it("falla cerrado sin nombre comercial o con un tenant distinto", async () => {
    await expect(generarRentabilidadPdf({ ...INPUT, organizacion: { id: "org-sintetica", nombre: "  " } })).rejects.toThrow("identificar la organización");
    await expect(generarRentabilidadPdf({ ...INPUT, organizacion: { id: "otra-org-sintetica", nombre: "Otra" } })).rejects.toThrow("identificar la organización");
    expect(mockDescargar).not.toHaveBeenCalled();
  });

  it("cancela si cambia tenant durante la carga dinámica del documento", async () => {
    const result = generarRentabilidadPdf(INPUT);
    syncActiveOrganizationScope({ userId: "user-sintetico", organizationId: "otra-org-sintetica" });
    await expect(result).rejects.toThrow("cambió el usuario o la organización");
    expect(mockDescargar).not.toHaveBeenCalled();
  });

  it("propaga el error si descargarPdf lanza", async () => {
    mockDescargar.mockRejectedValue(new Error("PDF error"));
    await expect(generarRentabilidadPdf(INPUT)).rejects.toThrow("PDF error");
  });
});
