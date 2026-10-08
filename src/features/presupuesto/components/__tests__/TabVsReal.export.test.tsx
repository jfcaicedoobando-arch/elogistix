import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TabVsReal } from "../TabVsReal";
const mocks = vi.hoisted(() => ({ download: vi.fn(), run: vi.fn(), query: vi.fn(), emisor: vi.fn() }));
vi.mock("@/features/presupuesto/hooks", () => ({ usePresupuestoVsReal: mocks.query }));
vi.mock("@/hooks/shared", () => ({ usePdfExport: () => ({ isExporting: false, run: mocks.run }) }));
vi.mock("@/pdf/render/descargarPdf", () => ({ descargarPdf: mocks.download }));
vi.mock("@/pdf/documents/ReportePresupuestoDocument", () => ({ ReportePresupuestoDocument: () => null }));
vi.mock("@/lib/filenames", () => ({ slugifyOrg: (name: string) => name.replace(/\s+/g, "_") }));
vi.mock("@/pdf/emisor", () => ({ cargarEmisorReporte: mocks.emisor }));
vi.mock("@/features/profit/hooks/usePeriodoMesUrl", () => ({ usePeriodoMesUrl: () => ({ mesActual: { key: "2026-10" }, setMesKey: vi.fn() }) }));
vi.mock("@/features/profit/components/PeriodoMensualToolbar", () => ({ PeriodoMensualToolbar: () => null }));
const normal = { categoria_id: "n", categoria_nombre: "Normal", presupuesto_mxn: 100, real_mxn: 50, variacion_mxn: -50, cumplimiento_pct: 50 };
const exceso = { categoria_id: "e", categoria_nombre: "Exceso", presupuesto_mxn: 100, real_mxn: 120, variacion_mxn: 20, cumplimiento_pct: 120 };
const resumen = { periodo: "2026-10", filas: [normal, exceso], total_presupuesto_mxn: 200, total_real_mxn: 170, variacion_neta_mxn: -30, categorias_en_exceso: 1, top_exceso: [exceso], gastos_sin_tc_count: 0, real_truncado: false };
beforeEach(() => {
  vi.clearAllMocks(); mocks.query.mockReturnValue({ data: resumen, organizationId: "org-a" });
  mocks.emisor.mockResolvedValue({ organizacionNombre: "Marca A", razonSocial: "Empresa", rfc: "" });
  mocks.run.mockImplementation(async (f: () => Promise<unknown>) => f());
});
it("exporta exactamente las filas de Solo excesos con indicador de alcance", async () => {
  render(<TabVsReal />);
  fireEvent.click(screen.getByRole("switch", { name: "Solo excesos" }));
  expect(screen.queryByText("Normal")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "PDF" }));
  await waitFor(() => expect(mocks.download).toHaveBeenCalledOnce());
  expect(mocks.download.mock.calls[0][0].props).toMatchObject({ resumen, filas: [exceso], soloExcesos: true });
  expect(mocks.emisor).toHaveBeenCalledWith("org-a");
  expect(mocks.download.mock.calls[0][0].props.emisor.organizacionNombre).toBe("Marca A");
});
it("el filtro vacío sigue vacío en el PDF y el reporte parcial avisa", async () => {
  mocks.query.mockReturnValue({ data: { ...resumen, filas: [normal], notas_proveedor_sin_base_count: 1 }, organizationId: "org-a" });
  render(<TabVsReal />);
  expect(screen.getByRole("status")).toHaveTextContent("Reporte provisional");
  fireEvent.click(screen.getByRole("switch", { name: "Solo excesos" }));
  fireEvent.click(screen.getByRole("button", { name: "PDF" }));
  await waitFor(() => expect(mocks.download).toHaveBeenCalledOnce());
  expect(mocks.download.mock.calls[0][0].props).toMatchObject({ filas: [], soloExcesos: true });
});
