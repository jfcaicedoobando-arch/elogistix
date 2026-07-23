import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/facturacion/services", () => ({
  fetchEstadoCuentaFacturas: vi.fn(),
}));
vi.mock("@/pdf/emisor", () => ({
  cargarEmisorEmpresa: vi.fn(),
}));
vi.mock("@/lib/formatters", () => ({
  formatCurrency: (n: number, m: string) => `${m}${n}`,
  formatDate: (d: string) => d,
  formatFechaHora: (d: string | Date) => String(d),
}));
vi.mock("@/lib/utils", () => ({
  escapeHtml: (s: string) => s,
}));

import { generarEstadoCuentaPdf } from "../estadoCuentaPdf";
import { fetchEstadoCuentaFacturas } from "@/features/facturacion/services";
import { cargarEmisorEmpresa } from "@/pdf/emisor";

const mockFetch = fetchEstadoCuentaFacturas as ReturnType<typeof vi.fn>;
const mockEmisor = cargarEmisorEmpresa as ReturnType<typeof vi.fn>;

const CLIENTE = { id: "c1", nombre: "Acme SA", rfc: "ACM123456ABC" };

function setupWindowOpen(capture: { html?: string }) {
  const doc = {
    write: vi.fn((h: string) => { capture.html = h; }),
    close: vi.fn(),
  };
  const win = { document: doc, onload: null as null | (() => void), print: vi.fn() };
  vi.stubGlobal("open", vi.fn(() => win));
  return win;
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockEmisor.mockResolvedValue({ razonSocial: "Empresa Test" });
});

describe("generarEstadoCuentaPdf", () => {
  it("abre ventana y escribe HTML con datos de facturas", async () => {
    const capture: { html?: string } = {};
    setupWindowOpen(capture);
    mockFetch.mockResolvedValue([
      {
        numero: "F-001",
        expediente: "EXP-001",
        fecha_emision: "2024-01-01",
        fecha_vencimiento: "2024-02-01",
        total: 1500,
        moneda: "MXN",
        estado: "pendiente",
      },
    ]);

    await generarEstadoCuentaPdf(CLIENTE);
    expect(capture.html).toContain("F-001");
    expect(capture.html).toContain("Acme SA");
  });

  it("muestra mensaje 'No hay facturas' cuando lista vacía", async () => {
    const capture: { html?: string } = {};
    setupWindowOpen(capture);
    mockFetch.mockResolvedValue([]);

    await generarEstadoCuentaPdf(CLIENTE);
    expect(capture.html).toContain("No hay facturas pendientes");
  });

  it("categoriza facturas vencidas en bucket correcto", async () => {
    const capture: { html?: string } = {};
    setupWindowOpen(capture);
    // Fecha vencimiento hace 45 días => bucket 31-60 días
    const past = new Date();
    past.setDate(past.getDate() - 45);
    mockFetch.mockResolvedValue([
      {
        numero: "F-002",
        expediente: "EXP-002",
        fecha_emision: "2024-01-01",
        fecha_vencimiento: past.toISOString().slice(0, 10),
        total: 500,
        moneda: "USD",
        estado: "vencida",
      },
    ]);

    await generarEstadoCuentaPdf(CLIENTE);
    expect(capture.html).toContain("31-60 días");
  });
});
