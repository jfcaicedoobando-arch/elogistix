import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/features/facturacion/services", () => ({
  fetchEstadoCuentaFacturas: vi.fn(),
}));
vi.mock("@/pdf/emisor", () => ({
  cargarEmisorDocumento: vi.fn(),
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
import { cargarEmisorDocumento } from "@/pdf/emisor";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { descargarPdf } from "@/pdf/render/descargarPdf";
import type { EstadoCuentaRow, EstadoCuentaMonedaTotal } from "@/pdf/documents/EstadoCuentaDocument";
import type { EstadoCuentaAlcance } from "@/pdf/components/EstadoCuentaAlcance";

const mockFetch = fetchEstadoCuentaFacturas as ReturnType<typeof vi.fn>;
const mockEmisor = cargarEmisorDocumento as ReturnType<typeof vi.fn>;
const mockDescargar = descargarPdf as ReturnType<typeof vi.fn>;

const CLIENTE = { id: "c1", organization_id: "org-a", nombre: "Acme SA", rfc: "ACM123456ABC" };

interface DocumentoProps {
  cliente: { nombre: string };
  rows: EstadoCuentaRow[];
  totalesPorMoneda: EstadoCuentaMonedaTotal[];
  alcance: EstadoCuentaAlcance;
}

function propsCapturados(): DocumentoProps {
  const [elemento] = mockDescargar.mock.calls[0] as [{ props: DocumentoProps }, string];
  return elemento.props;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-04T18:00:00Z"));
  vi.clearAllMocks();
  setAuthSnapshot({ userId: "u1", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "u1", organizationId: "org-a" });
  mockEmisor.mockResolvedValue({ razonSocial: "Empresa Test", organizacionNombre: "Org" });
  mockDescargar.mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

describe("generarEstadoCuentaPdf", () => {
  it("descarga el PDF con las facturas y el nombre de archivo con prefijo de org", async () => {
    mockFetch.mockResolvedValue([
      {
        numero: "F-001",
        expediente: "EXP-001",
        fecha_emision: "2024-01-01",
        fecha_vencimiento: "2024-02-01",
        total: 1500,
        saldo: 1500,
        moneda: "MXN",
        estado: "Emitida",
      },
    ]);

    await generarEstadoCuentaPdf(CLIENTE);

    expect(mockDescargar).toHaveBeenCalledOnce();
    expect(mockEmisor).toHaveBeenCalledWith("org-a");
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
        saldo: 500,
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

  it("suma saldo neto en filas, pendiente y antigüedad sin volver a consultar el corte", async () => {
    const snapshot = [
      { numero: "A3", expediente: "E3", fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-10",
        total: 116, saldo: 58, moneda: "MXN", estado: "Emitida" },
      { numero: "Parcial", expediente: "E4", fecha_emision: "2026-09-01", fecha_vencimiento: "2026-09-15",
        total: 200, saldo: 150, moneda: "MXN", estado: "Parcialmente pagada" },
      { numero: "USD", expediente: "E5", fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-10",
        total: 100, saldo: 70, moneda: "USD", estado: "Parcialmente pagada" },
    ];
    await generarEstadoCuentaPdf(CLIENTE, snapshot);
    expect(mockFetch).not.toHaveBeenCalled();
    const props = propsCapturados();
    expect(props.rows.map((r) => r.saldo)).toEqual([58, 150, 70]);
    const mxn = props.totalesPorMoneda.find((t) => t.moneda === "MXN");
    expect(mxn?.total).toBe(208);
    expect(mxn?.buckets.find((b) => b.label === "Por vencer")?.total).toBe(58);
    expect(mxn?.buckets.find((b) => b.label === "1-30 días")?.total).toBe(150);
    expect(props.totalesPorMoneda.find((t) => t.moneda === "USD")?.total).toBe(70);
  });

  it("respeta un corte explícito vacío sin cargar facturas fuera del filtro", async () => {
    await generarEstadoCuentaPdf(CLIENTE, []);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(propsCapturados().rows).toEqual([]);
    expect(propsCapturados().totalesPorMoneda).toEqual([]);
  });

  it("preserva el subtotal de 58 y documenta el filtro de antigüedad", async () => {
    const alcance = { parcial: true, filtros: ["Antigüedad: 1-30 días"] };
    await generarEstadoCuentaPdf(CLIENTE, [{ numero: "A3", expediente: "E3", fecha_emision: "2026-10-01",
      fecha_vencimiento: "2026-10-03", total: 116, saldo: 58, moneda: "MXN", estado: "Emitida" }], alcance);
    const props = propsCapturados();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(props.alcance).toEqual(alcance);
    expect(props.totalesPorMoneda[0].total).toBe(58);
    expect(props.rows[0].saldo).toBe(58);
  });

  it("propaga el error si descargarPdf lanza al generar el estado de cuenta", async () => {
    mockFetch.mockResolvedValue([]);
    mockDescargar.mockRejectedValue(new Error("PDF error"));
    await expect(generarEstadoCuentaPdf(CLIENTE)).rejects.toThrow("PDF error");
  });

  it("no descarga si cambia el tenant antes de terminar la carga", async () => {
    const pending = generarEstadoCuentaPdf(CLIENTE, []);
    syncActiveOrganizationScope({ userId: "u1", organizationId: "org-b" });
    await expect(pending).rejects.toThrow("cambió el usuario o la organización");
    expect(mockDescargar).not.toHaveBeenCalled();
  });
});
