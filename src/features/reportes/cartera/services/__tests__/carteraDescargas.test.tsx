import type { ComponentProps, ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { descargarCarteraCsv, descargarCarteraPdf } from "../carteraDescargas";
import { construirFilasCartera, totalCartera, totalesPorBucket } from "../../domain/agingCartera";
import { captureAuthDataScope, syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { resetSessionCaches } from "@/lib/auth/sessionCacheRegistry";
import type { ReporteCarteraDocument } from "@/pdf/documents/ReporteCarteraDocument";

const mocks = vi.hoisted(() => ({ pdf: vi.fn(), csv: vi.fn(), emisor: vi.fn(), error: vi.fn() }));
vi.mock("@/pdf/render/descargarPdf", () => ({ descargarPdf: mocks.pdf }));
vi.mock("@/features/configuracion/services/emisorPdf", () => ({ fetchEmisorReporte: mocks.emisor }));
vi.mock("@/lib/downloadBlob", () => ({ descargarBlob: mocks.csv }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: mocks.error, notifyWarning: vi.fn() }));

const filas = construirFilasCartera([{
  id: "fp-7", folio: "FP-000007", contraparte: "Agente marítimo Monterrey", expediente: "ELIMP00010",
  moneda: "USD", saldo: 700, tipoCambio: 17.5, fechaEmision: "2026-09-26", fechaVencimiento: "2026-09-27",
}], "2026-09-30", { usdMxn: 18.071, eurMxn: null, fecha: "2026-09-30", exacto: true });
const bloque = { titulo: "Cuentas por pagar", filas, buckets: totalesPorBucket(filas), total: totalCartera(filas) };

function session(organizationId: string | null = "org-a") {
  setAuthSnapshot({ userId: "user-a", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "user-a", organizationId });
}

beforeEach(() => {
  vi.resetAllMocks();
  session();
  mocks.pdf.mockResolvedValue(undefined);
  mocks.emisor.mockResolvedValue({ razonSocial: "Organización sintética SA", organizacionNombre: "Identidad comercial A" });
});

describe("Cartera — contrato de descarga filtrada", () => {
  it("entrega el filtro al documento y distingue el PDF parcial sin cambiar importes", async () => {
    await descargarCarteraPdf("2026-09-30", "TC DOF USD/MXN 18.0710", [bloque], captureAuthDataScope(), " FP-000007 ");
    expect(mocks.pdf).toHaveBeenCalledTimes(1);
    const [documento, nombre] = mocks.pdf.mock.calls[0] as [ReactElement<ComponentProps<typeof ReporteCarteraDocument>>, string];
    expect(nombre).toBe("cartera-antiguedad-2026-09-30-filtrada.pdf");
    expect(documento.props.busqueda).toBe(" FP-000007 ");
    expect(documento.props.emisor?.razonSocial).toBe("Organización sintética SA");
    expect(documento.props.emisor?.organizacionNombre).toBe("Identidad comercial A");
    expect(mocks.emisor).toHaveBeenCalledWith("org-a");
    expect(documento.props.bloques[0].facturas[0]).toMatchObject({ folio: "FP-000007", saldo: "700.00", mxnCorte: "12649.70", diferencia: "399.70" });
  });

  it("conserva el nombre original cuando la búsqueda está vacía", async () => {
    await descargarCarteraPdf("2026-09-30", "TC DOF USD/MXN 18.0710", [bloque], captureAuthDataScope(), "  ");
    expect(mocks.pdf).toHaveBeenCalledWith(expect.anything(), "cartera-antiguedad-2026-09-30.pdf");
  });

  it("distingue el CSV filtrado sin alterar su estructura contable", () => {
    descargarCarteraCsv("2026-09-30", [bloque], captureAuthDataScope(), "FP-000007");
    expect(mocks.csv).toHaveBeenCalledWith(expect.any(Blob), "cartera-antiguedad-2026-09-30-filtrada.csv");
  });
});



describe("Cartera: identidad vinculada al snapshot", () => {
  it("rechaza el snapshot de A si ya está activo B antes de iniciar la identidad", async () => {
    const scope = captureAuthDataScope();
    session("org-b");
    await descargarCarteraPdf("2026-09-30", "TC", [bloque], scope);
    expect(mocks.emisor).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ method: "CARTERA_AGING_PDF" }));
  });

  it("bloquea ambos archivos tras A → B → A, aunque el ID final coincida", async () => {
    const scope = captureAuthDataScope();
    session("org-b");
    session("org-a");
    await descargarCarteraPdf("2026-09-30", "TC", [bloque], scope);
    descargarCarteraCsv("2026-09-30", [bloque], scope);
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(mocks.csv).not.toHaveBeenCalled();
  });

  it("bloquea una sesión revocada aunque organización y usuario no cambien", async () => {
    const scope = captureAuthDataScope();
    resetSessionCaches();
    await descargarCarteraPdf("2026-09-30", "TC", [bloque], scope);
    expect(mocks.emisor).not.toHaveBeenCalled();
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it("descarta la identidad que termina de cargar después de cambiar de tenant", async () => {
    mocks.emisor.mockImplementation(async () => { session("org-b"); return { organizacionNombre: "Identidad A" }; });
    await descargarCarteraPdf("2026-09-30", "TC", [bloque], captureAuthDataScope());
    expect(mocks.pdf).not.toHaveBeenCalled();
  });

  it("no sustituye por Empresa genérica un error al resolver la identidad", async () => {
    mocks.emisor.mockRejectedValue(new Error("Identidad no disponible"));
    await descargarCarteraPdf("2026-09-30", "TC", [bloque], captureAuthDataScope());
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledOnce();
  });

  it("deja neutro un snapshot global autenticado, sin adoptar otra empresa", async () => {
    session(null);
    mocks.emisor.mockResolvedValue(undefined);
    await descargarCarteraPdf("2026-09-30", "TC", [bloque], captureAuthDataScope());
    expect(mocks.emisor).toHaveBeenCalledWith(null);
    expect(mocks.pdf.mock.calls[0][0].props.emisor).toBeUndefined();
  });
});
