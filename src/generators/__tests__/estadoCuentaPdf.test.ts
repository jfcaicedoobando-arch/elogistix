import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/facturacion/services", () => ({
  fetchEstadoCuentaFacturas: vi.fn(),
}));
vi.mock("@/pdf/emisor", () => ({
  cargarEmisorEmpresa: vi.fn(),
}));
vi.mock("@/lib/filenames", () => ({
  slugifyOrg: (s: string) => s.replace(/\s+/g, "_"),
  withOrgPrefix: vi.fn(async (name: string) => `Org_${name}`),
}));
vi.mock("@/pdf/render/descargarPdf", () => ({
  descargarPdf: vi.fn(),
}));
vi.mock("@/pdf/documents/EstadoCuentaDocument", () => ({
  EstadoCuentaDocument: vi.fn(() => null),
}));

import { generarEstadoCuentaPdf } from "../estadoCuentaPdf";
import { fetchEstadoCuentaFacturas } from "@/features/facturacion/services";
import { cargarEmisorEmpresa } from "@/pdf/emisor";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import type { EstadoCuentaRow, EstadoCuentaMonedaTotal } from "@/pdf/documents/EstadoCuentaDocument";

const mockFetch = fetchEstadoCuentaFacturas as ReturnType<typeof vi.fn>;
const mockEmisor = cargarEmisorEmpresa as ReturnType<typeof vi.fn>;
const mockDescargar = descargarPdf as ReturnType<typeof vi.fn>;

const CLIENTE = { id: "c1", nombre: "Acme SA", rfc: "ACM123456ABC" };

interface DocumentoProps {
  cliente: { nombre: string };
  rows: EstadoCuentaRow[];
  totalesPorMoneda: EstadoCuentaMonedaTotal[];
}

function propsCapturados(): DocumentoProps {
  const [elemento] = mockDescargar.mock.calls[0] as [{ props: DocumentoProps }, string];
  return elemento.props;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEmisor.mockResolvedValue({ razonSocial: "Empresa Test" });
  mockDescargar.mockResolvedValue(undefined);
});

describe("generarEstadoCuentaPdf", () => {
  it("descarga el PDF con las facturas y el nombre de archivo con prefijo de org", async () => {
    mockFetch.mockResolvedValue([
      {
        numero: "F-001",
        expediente: "EXP-001",
        fecha_emision: "2024-01-01",
        fecha_vencimiento: "2024-02-01",
        total: 1500,
        moneda: "MXN",
        estado: "Emitida",
      },
    ]);

    await generarEstadoCuentaPdf(CLIENTE);

    expect(mockDescargar).toHaveBeenCalledOnce();
    const [, filename] = mockDescargar.mock.calls[0] as [unknown, string];
    expect(filename).toBe("Org_estado-de-cuenta-Acme_SA");

    const props = propsCapturados();
    expect(props.cliente.nombre).toBe("Acme SA");
    expect(props.rows).toHaveLength(1);
    expect(props.rows[0].numero).toBe("F-001");
  });

  it("manda lista vacía cuando el cliente no tiene facturas", async () => {
    mockFetch.mockResolvedValue([]);

    await generarEstadoCuentaPdf(CLIENTE);

    const props = propsCapturados();
    expect(props.rows).toHaveLength(0);
    expect(props.totalesPorMoneda).toHaveLength(0);
  });

  it("categoriza facturas vencidas en bucket 31-60 días", async () => {
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
        estado: "Vencida",
      },
    ]);

    await generarEstadoCuentaPdf(CLIENTE);

    const props = propsCapturados();
    expect(props.rows[0].bucket).toBe("31-60 días");
    const usd = props.totalesPorMoneda.find((t) => t.moneda === "USD");
    expect(usd?.total).toBe(500);
    expect(usd?.buckets.find((b) => b.label === "31-60 días")?.total).toBe(500);
  });

  it("propaga el error si descargarPdf lanza al generar el estado de cuenta", async () => {
    mockFetch.mockResolvedValue([]);
    mockDescargar.mockRejectedValue(new Error("PDF error"));
    await expect(generarEstadoCuentaPdf(CLIENTE)).rejects.toThrow("PDF error");
  });
});
