import type { ComponentProps, ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { descargarCarteraCsv, descargarCarteraPdf } from "../carteraDescargas";
import { construirFilasCartera, totalCartera, totalesPorBucket } from "../../domain/agingCartera";
import type { ReporteCarteraDocument } from "@/pdf/documents/ReporteCarteraDocument";

const mocks = vi.hoisted(() => ({ pdf: vi.fn(), csv: vi.fn() }));
vi.mock("@/pdf/render/descargarPdf", () => ({ descargarPdf: mocks.pdf }));
vi.mock("@/pdf/emisor", () => ({ cargarEmisorEmpresa: () => Promise.resolve({ razonSocial: "Organización sintética SA" }) }));
vi.mock("@/lib/downloadBlob", () => ({ descargarBlob: mocks.csv }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn(), notifyWarning: vi.fn() }));

const filas = construirFilasCartera([{
  id: "fp-7", folio: "FP-000007", contraparte: "Agente marítimo Monterrey", expediente: "ELIMP00010",
  moneda: "USD", saldo: 700, tipoCambio: 17.5, fechaEmision: "2026-09-26", fechaVencimiento: "2026-09-27",
}], "2026-09-30", { usdMxn: 18.071, eurMxn: null, fecha: "2026-09-30", exacto: true });
const bloque = { titulo: "Cuentas por pagar", filas, buckets: totalesPorBucket(filas), total: totalCartera(filas) };

beforeEach(() => { vi.clearAllMocks(); mocks.pdf.mockResolvedValue(undefined); });

describe("Cartera — contrato de descarga filtrada", () => {
  it("entrega el filtro al documento y distingue el PDF parcial sin cambiar importes", async () => {
    await descargarCarteraPdf("2026-09-30", "TC DOF USD/MXN 18.0710", [bloque], " FP-000007 ");
    expect(mocks.pdf).toHaveBeenCalledTimes(1);
    const [documento, nombre] = mocks.pdf.mock.calls[0] as [ReactElement<ComponentProps<typeof ReporteCarteraDocument>>, string];
    expect(nombre).toBe("cartera-antiguedad-2026-09-30-filtrada.pdf");
    expect(documento.props.busqueda).toBe(" FP-000007 ");
    expect(documento.props.emisor?.razonSocial).toBe("Organización sintética SA");
    expect(documento.props.bloques[0].facturas[0]).toMatchObject({ folio: "FP-000007", saldo: "700.00", mxnCorte: "12649.70", diferencia: "399.70" });
  });

  it("conserva el nombre original cuando la búsqueda está vacía", async () => {
    await descargarCarteraPdf("2026-09-30", "TC DOF USD/MXN 18.0710", [bloque], "  ");
    expect(mocks.pdf).toHaveBeenCalledWith(expect.anything(), "cartera-antiguedad-2026-09-30.pdf");
  });

  it("distingue el CSV filtrado sin alterar su estructura contable", () => {
    descargarCarteraCsv("2026-09-30", [bloque], "FP-000007");
    expect(mocks.csv).toHaveBeenCalledWith(expect.any(Blob), "cartera-antiguedad-2026-09-30-filtrada.csv");
  });
});
