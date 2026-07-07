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

const mockEmisor = cargarEmisorEmpresa as ReturnType<typeof vi.fn>;
const mockDescargar = descargarPdf as ReturnType<typeof vi.fn>;

const INPUT = {
  fechaDesde: "2024-01-01",
  fechaHasta: "2024-03-31",
  modo: "Marítimo",
  kpis: { total_venta_usd: 100000, total_costo_usd: 60000, total_profit_usd: 40000, margen_promedio: 40 },
  clientes: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEmisor.mockResolvedValue({ razonSocial: "Empresa SA" });
  mockDescargar.mockResolvedValue(undefined);
});

describe("generarRentabilidadPdf", () => {
  it("carga el emisor y llama descargarPdf con nombre de archivo correcto", async () => {
    await generarRentabilidadPdf(INPUT);
    expect(mockEmisor).toHaveBeenCalledOnce();
    expect(mockDescargar).toHaveBeenCalledOnce();
    const [, filename] = mockDescargar.mock.calls[0] as [unknown, string];
    expect(filename).toBe("Empresa_SA_rentabilidad-2024-01-01_2024-03-31");
  });

  it("propaga el error si descargarPdf lanza", async () => {
    mockDescargar.mockRejectedValue(new Error("PDF error"));
    await expect(generarRentabilidadPdf(INPUT)).rejects.toThrow("PDF error");
  });
});
