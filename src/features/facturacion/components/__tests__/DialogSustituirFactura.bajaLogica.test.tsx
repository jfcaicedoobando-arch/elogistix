import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
const m = vi.hoisted(() => ({ duplicate: vi.fn(), navigate: vi.fn(), write: vi.fn(), cancel: vi.fn(), lookup: vi.fn() }));
vi.mock("react-router", () => ({ useNavigate: () => m.navigate }));
vi.mock("@/features/facturacion/services/facturapi", () => ({ duplicarFacturaParaSustitucion: m.duplicate }));
vi.mock("@/features/facturacion/services/sustitutasDeFactura", () => ({ listarSustitutas: m.lookup }));
vi.mock("@/features/facturacion/services/sustitucionPersistence", () => ({ writePersisted: m.write, clearPersisted: vi.fn() }));
vi.mock("@/features/facturacion/hooks/useTimbrarFactura", () => ({ useCancelarFactura: () => ({ mutate: m.cancel }) }));
vi.mock("@/features/facturacion/hooks/useSustitucionState", () => ({ useSustitucionState: () => ({ step: "intro", setStep: vi.fn(), nuevaId: null, setNuevaId: vi.fn() }) }));
vi.mock("@/components/shared/FormDialogShell", () => ({ FormDialogShell: ({ children, footer, open }: { children: ReactNode; footer: ReactNode; open: boolean }) => open ? <>{children}{footer}</> : null }));
vi.mock("@/components/shared/Hint", () => ({ Hint: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifyInfo: vi.fn(), notifySuccess: vi.fn() }));
vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: vi.fn() }));
import { DialogSustituirFactura } from "../DialogSustituirFactura";

beforeEach(() => vi.clearAllMocks());
describe("Independent review: late substitution must not reopen timbrado", () => {
  it("deletion unmount during duplication prevents later automatic navigation", async () => {
    let resolve!: (id: string) => void;
    m.duplicate.mockReturnValue(new Promise<string>((r) => { resolve = r; }));
    const close = vi.fn();
    const { unmount } = render(<DialogSustituirFactura facturaId="invoice-a" numero="A" uuidOriginal="uuid-a" open onOpenChange={close} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear borrador y continuar" }));
    expect(m.duplicate).toHaveBeenCalledWith("invoice-a");
    unmount();
    await act(async () => { resolve("substitute-a"); await Promise.resolve(); });
    expect(m.navigate).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });
});

describe("sustitución: el resultado pertenece a su apertura", () => {
  it.each(["cerrar-reabrir", "A-B-A"])("%s invalida navegación, persistencia y cierre tardío", async (cambio) => {
    let resolve!: (id: string) => void;
    m.duplicate.mockReturnValueOnce(new Promise<string>((r) => { resolve = r; }));
    const close = vi.fn();
    const props = { facturaId: "invoice-a", numero: "A", uuidOriginal: "uuid-a", open: true, onOpenChange: close };
    const { rerender } = render(<DialogSustituirFactura {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear borrador y continuar" }));
    rerender(<DialogSustituirFactura {...props} facturaId={cambio === "A-B-A" ? "invoice-b" : "invoice-a"} open={cambio === "A-B-A"} />);
    rerender(<DialogSustituirFactura {...props} />);
    await act(async () => { resolve("substitute-a"); await Promise.resolve(); });
    expect(m.navigate).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Crear borrador y continuar" })).not.toBeDisabled();
  });
  it("lookup de sustituta pendiente no navega ni reabre timbrado tras desmontar", async () => {
    m.duplicate.mockRejectedValueOnce(new Error("factura_ya_sustituida"));
    let resolve!: (value: { id: string }[]) => void;
    m.lookup.mockReturnValueOnce(new Promise<{ id: string }[]>((r) => { resolve = r; }));
    const close = vi.fn();
    const { unmount } = render(<DialogSustituirFactura facturaId="invoice-a" open uuidOriginal="uuid-a" onOpenChange={close} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Crear borrador y continuar" })); await Promise.resolve(); });
    expect(m.lookup).toHaveBeenCalledWith("invoice-a");
    unmount();
    await act(async () => { resolve([{ id: "substitute-a" }]); await Promise.resolve(); });
    expect(m.navigate).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled(); expect(m.write).not.toHaveBeenCalled();
  });
  it("rechazo tardío tras desmontar no inicia un lookup nuevo", async () => {
    let reject!: (error: Error) => void;
    m.duplicate.mockReturnValueOnce(new Promise<string>((_, r) => { reject = r; }));
    const { unmount } = render(<DialogSustituirFactura facturaId="invoice-a" open uuidOriginal="uuid-a" onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear borrador y continuar" })); unmount();
    await act(async () => { reject(new Error("factura_ya_sustituida")); await Promise.resolve(); });
    expect(m.lookup).not.toHaveBeenCalled(); expect(m.navigate).not.toHaveBeenCalled();
  });
  it("contexto vigente conserva duplicación y autoacción", async () => {
    m.duplicate.mockResolvedValueOnce("substitute-a");
    const close = vi.fn();
    render(<DialogSustituirFactura facturaId="invoice-a" open uuidOriginal="uuid-a" onOpenChange={close} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Crear borrador y continuar" })); await Promise.resolve(); });
    expect(m.write).toHaveBeenCalledWith("invoice-a", "substitute-a");
    expect(m.navigate).toHaveBeenCalledWith("/facturacion/substitute-a?accion=timbrar");
    expect(close).toHaveBeenCalledWith(false);
  });
});
