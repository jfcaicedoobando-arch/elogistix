import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureAuthDataScope } from "@/lib/auth/authOperationScope";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { construirFilasCartera, totalCartera, totalesPorBucket } from "../../domain/agingCartera";
import ReportesCartera from "../ReportesCartera";

const mocks = vi.hoisted(() => ({
  aging: vi.fn(), day: "2026-10-13", download: vi.fn(), pdf: vi.fn(),
  issuer: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn(),
}));
vi.mock("../../hooks/useCarteraAging", () => ({ useCarteraAging: mocks.aging }));
vi.mock("@/hooks/shared", () => ({ useDocumentTitle: vi.fn() }));
vi.mock("@/hooks/shared/useDiaNegocio", () => ({ useDiaNegocio: () => mocks.day }));
vi.mock("@/lib/date/today", () => ({ todayLocalISO: () => mocks.day }));
vi.mock("@/features/facturacion/services", () => ({ fetchCobranza: vi.fn(), fetchCobranzaKpis: vi.fn() }));
vi.mock("@/features/cxp/services", () => ({ fetchFacturasCxP: vi.fn() }));
vi.mock("@/features/configuracion/services/emisorPdf", () => ({ fetchEmisorReporte: mocks.issuer }));
vi.mock("@/pdf/documents/ReporteCarteraDocument", () => ({ ReporteCarteraDocument: () => null }));
vi.mock("@react-pdf/renderer", () => ({ pdf: mocks.pdf }));
vi.mock("@/lib/downloadBlob", () => ({ descargarBlob: mocks.download }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: mocks.success, notifyError: mocks.error, notifyWarning: mocks.warning }));
vi.mock("../../components/CarteraBloque", () => ({ CarteraBloque: () => null }));
vi.mock("@/components/ui/button", () => ({ Button: ({ loading: _loading, variant: _variant, size: _size, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string; size?: string }) => <button {...props} /> }));
vi.mock("@/components/ui/input", () => ({ Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock("@/components/ui/label", () => ({ Label: (props: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props} /> }));
vi.mock("@/components/ui/card", () => ({ Card: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />, CardContent: (props: HTMLAttributes<HTMLDivElement>) => <div {...props} /> }));
vi.mock("@/components/shared/PageContainer", () => ({ PageContainer: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/shared/PageHeader", () => ({ PageHeader: ({ actions }: { actions: ReactNode }) => <header>{actions}</header> }));
vi.mock("@/components/ui/date-picker-mx", () => ({ DatePickerMx: ({ id, value, disabled }: { id: string; value: string; disabled: boolean }) => <input id={id} value={value} disabled={disabled} readOnly /> }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function scope(organizationId = "org-a") {
  setAuthSnapshot({ userId: "user-a", email: null, organizationId, organizationName: null, role: "admin", effectiveRole: "admin" });
  const { userId, role, generation } = captureAuthDataScope();
  return { userId, role, generation, organizationId };
}

const filas = construirFilasCartera([{
  id: "synthetic-invoice", folio: "F-1", contraparte: "Synthetic customer", expediente: "EXP-1",
  moneda: "USD", saldo: 100, tipoCambio: 18, fechaEmision: "2026-10-01", fechaVencimiento: "2026-10-10",
}], "2026-10-13", { usdMxn: 20, eurMxn: null, fecha: "2026-10-13", exacto: true });
const cxc = { titulo: "Cuentas por cobrar", filas, buckets: totalesPorBucket(filas), total: totalCartera(filas) };
const cxp = { titulo: "Cuentas por pagar", filas: [], buckets: totalesPorBucket([]), total: totalCartera([]) };
function ready() { return { dataScope: scope(), tc: null, tcLoading: false, tcError: false, cxc, cxp, isLoading: false, isError: false, refetch: vi.fn() }; }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.day = "2026-10-13";
  mocks.aging.mockReturnValue(ready());
  mocks.issuer.mockResolvedValue({ razonSocial: "Synthetic issuer" });
});
afterEach(cleanup);

async function begin(expectedCalls = 1) {
  fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
  await waitFor(() => expect(mocks.pdf).toHaveBeenCalledTimes(expectedCalls));
}
async function finish(job: ReturnType<typeof deferred<Blob>>) {
  await act(async () => { job.resolve(new Blob(["synthetic PDF"])); await job.promise; });
}

describe("Cartera PDF route lifecycle", () => {
  it("never downloads or notifies after unmount during a delayed render", async () => {
    const job = deferred<Blob>();
    mocks.pdf.mockReturnValue({ toBlob: () => job.promise });
    const view = render(<ReportesCartera />);
    await begin();
    view.unmount();
    await finish(job);
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("downloads one current PDF with unchanged financial formatting and filename", async () => {
    const job = deferred<Blob>();
    mocks.pdf.mockReturnValue({ toBlob: () => job.promise });
    render(<ReportesCartera />);
    await begin();
    expect(screen.getByRole("button", { name: "Generando…" })).toBeDisabled();
    expect(mocks.pdf.mock.calls[0][0].props.bloques[0].facturas[0]).toMatchObject({ folio: "F-1", saldo: "100.00", mxnHistorico: "1800.00", mxnCorte: "2000.00" });
    await finish(job);
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(expect.any(Blob), "cartera-antiguedad-2026-10-13.pdf");
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeEnabled();
  });

  it.each(["filter", "organization", "day", "refetch", "scope", "blocks"])("permanently invalidates a delayed PDF after changing %s", async (change) => {
    const job = deferred<Blob>();
    const original = mocks.aging();
    mocks.pdf.mockReturnValue({ toBlob: () => job.promise });
    const view = render(<ReportesCartera />);
    await begin();
    if (change === "filter") {
      fireEvent.change(screen.getByRole("textbox", { name: "Cliente, proveedor, folio o expediente" }), { target: { value: "other" } });
      fireEvent.change(screen.getByRole("textbox", { name: "Cliente, proveedor, folio o expediente" }), { target: { value: "" } });
    } else {
      if (change === "organization") mocks.aging.mockReturnValue({ ...original, dataScope: scope("org-b") });
      if (change === "day") mocks.day = "2026-10-14";
      if (change === "refetch") mocks.aging.mockReturnValue({ ...original, isLoading: true });
      if (change === "scope") mocks.aging.mockReturnValue({ ...original, dataScope: undefined });
      if (change === "blocks") mocks.aging.mockReturnValue({ ...original, cxc: { ...cxc } });
      view.rerender(<ReportesCartera />);
      mocks.day = "2026-10-13";
      mocks.aging.mockReturnValue(change === "organization" ? { ...original, dataScope: scope() } : original);
      view.rerender(<ReportesCartera />);
    }
    await finish(job);
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeEnabled();
  });

  it.each(["resolve", "reject"])("old %s cannot download, notify or clear a replacement job", async outcome => {
    const old = deferred<Blob>();
    const current = deferred<Blob>();
    mocks.pdf.mockReturnValueOnce({ toBlob: () => old.promise }).mockReturnValueOnce({ toBlob: () => current.promise });
    render(<ReportesCartera />);
    await begin();
    fireEvent.change(screen.getByRole("textbox", { name: "Cliente, proveedor, folio o expediente" }), { target: { value: "F-1" } });
    await begin(2);
    await act(async () => { if (outcome === "resolve") old.resolve(new Blob(["old"])); else old.reject(new Error("old renderer failed")); await old.promise.catch(() => undefined); });
    expect(screen.getByRole("button", { name: "Generando…" })).toBeDisabled();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
    await finish(current);
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(expect.any(Blob), "cartera-antiguedad-2026-10-13-filtrada.pdf");
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeEnabled();
  });

  it("does not start a render when issuer loading completes after unmount", async () => {
    const identity = deferred<{ razonSocial: string }>();
    mocks.issuer.mockReturnValue(identity.promise);
    const view = render(<ReportesCartera />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(mocks.issuer).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => { identity.resolve({ razonSocial: "Late issuer" }); await identity.promise; });
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("silences an issuer failure after unmount", async () => {
    const identity = deferred<never>();
    mocks.issuer.mockReturnValue(identity.promise);
    const view = render(<ReportesCartera />);
    fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(mocks.issuer).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => { identity.reject(new Error("Late issuer error")); await identity.promise.catch(() => undefined); });
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("shows a current renderer error and allows retry", async () => {
    const broken = deferred<Blob>();
    mocks.pdf.mockReturnValueOnce({ toBlob: () => broken.promise }).mockReturnValueOnce({ toBlob: () => Promise.resolve(new Blob(["retry"])) });
    render(<ReportesCartera />);
    await begin();
    const error = new Error("Current renderer failure");
    await act(async () => { broken.reject(error); await broken.promise.catch(() => undefined); });
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(undefined, expect.objectContaining({ error, method: "CARTERA_AGING_PDF" }));
    await begin(2);
    await waitFor(() => expect(mocks.download).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeEnabled();
  });

  it("still exports after StrictMode effect replay", async () => {
    const job = deferred<Blob>();
    mocks.pdf.mockReturnValue({ toBlob: () => job.promise });
    render(<StrictMode><ReportesCartera /></StrictMode>);
    await begin();
    await finish(job);
    expect(mocks.download).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledOnce();
  });

  it("back/forward-style remount only downloads the newly mounted route's job", async () => {
    const old = deferred<Blob>();
    const current = deferred<Blob>();
    mocks.pdf.mockReturnValueOnce({ toBlob: () => old.promise }).mockReturnValueOnce({ toBlob: () => current.promise });
    const previous = render(<ReportesCartera />);
    await begin();
    previous.unmount();
    render(<ReportesCartera />);
    await begin(2);
    await finish(old);
    expect(mocks.download).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Generando…" })).toBeDisabled();
    await finish(current);
    expect(mocks.download).toHaveBeenCalledOnce();
  });
});
