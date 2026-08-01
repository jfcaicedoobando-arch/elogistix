// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadCsvWithFeedback } from "../notifyCsvExport";
import { notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyWarning: vi.fn(),
}));

describe("downloadCsvWithFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (URL.createObjectURL as unknown) = vi.fn(() => "blob:mock-url");
    (URL.revokeObjectURL as unknown) = vi.fn();
  });

  it("muestra warning por default y no descarga cuando rowCount es 0", () => {
    downloadCsvWithFeedback({ filename: "a.csv", csv: "h\n", rowCount: 0 });
    expect(notifyWarning).toHaveBeenCalledWith(undefined, {
      title: "Sin datos para exportar",
      description: "Ajusta los filtros e inténtalo de nuevo — no hay filas visibles.",
    });
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("muestra warning con copy personalizado cuando rowCount es negativo", () => {
    downloadCsvWithFeedback({
      filename: "a.csv",
      csv: "",
      rowCount: -1,
      emptyWarning: { title: "Vacío", description: "No hay nada" },
    });
    expect(notifyWarning).toHaveBeenCalledWith(undefined, {
      title: "Vacío",
      description: "No hay nada",
    });
  });

  it("usa solo el title personalizado si description no viene", () => {
    downloadCsvWithFeedback({
      filename: "a.csv",
      csv: "",
      rowCount: 0,
      emptyWarning: { title: "Solo título" },
    });
    expect(notifyWarning).toHaveBeenCalledWith(undefined, {
      title: "Solo título",
      description: "Ajusta los filtros e inténtalo de nuevo — no hay filas visibles.",
    });
  });

  it("usa solo la description personalizada si title no viene", () => {
    downloadCsvWithFeedback({
      filename: "a.csv",
      csv: "",
      rowCount: 0,
      emptyWarning: { description: "Sólo descripción" },
    });
    expect(notifyWarning).toHaveBeenCalledWith(undefined, {
      title: "Sin datos para exportar",
      description: "Sólo descripción",
    });
  });

  it("descarga el CSV y notifica éxito cuando hay filas", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadCsvWithFeedback({ filename: "reporte.csv", csv: "a,b\n1,2", rowCount: 1 });

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    expect(notifySuccess).toHaveBeenCalledWith(undefined, {
      title: "CSV descargado",
      description: "reporte.csv · 1 fila(s)",
    });
    expect(notifyWarning).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
