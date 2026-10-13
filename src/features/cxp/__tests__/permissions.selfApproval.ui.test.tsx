/** Approval-only regression: real permission helper, auth hook and action controls. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { AppRole } from "@/types/appRole";
import type { FacturaCxP } from "@/features/cxp/services";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StatusActionBar } from "@/features/cxp/components/DialogDetallePagosProveedor.actionbar";
import { computeFacturaFlags } from "@/features/cxp/components/DialogDetallePagosProveedor.flags";
import { useSodAprobacion } from "@/features/cxp/hooks/useSodAprobacion";
import { useColumnasPorAprobar } from "@/features/compras/routes/ComprasPorAprobar.useColumnas";
import { puedeAprobarFacturaProveedor } from "@/features/cxp/permissions";

const auth = vi.hoisted(() => ({ user: { id: "actor" }, effectiveRole: "contador" as AppRole }));
const mutation = vi.hoisted(() => ({ isPending: false }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/features/cxp/hooks/useAprobarFactura", () => ({ useAprobarFactura: () => mutation }));
vi.mock("@/features/cxp/hooks", () => ({ useSodAprobacion }));
vi.mock("@/features/cxp", () => ({ buildCxPColumns: () => [] }));
vi.mock("@/components/shared/DataTable", () => ({ defineColumns: (columns: unknown) => columns }));
vi.mock("@/features/cxp/components/DialogDetallePagosProveedor.aprobardialogs", () => ({
  AprobarRechazarDialogs: ({ openAprobar, openRechazar }: { openAprobar: boolean; openRechazar: boolean }) => (
    <>{openAprobar && <div role="dialog">Confirmar aprobación</div>}{openRechazar && <div role="dialog">Confirmar rechazo</div>}</>
  ),
}));

const invoice = { id: "own", created_by: "actor", folio_proveedor: "F-1", estado: "Vigente", estado_aprobacion: "pendiente", saldo: 100, pagado: 0 } as FacturaCxP;
function Detail({ f = invoice, canApprove = true, onPagar = vi.fn() }: { f?: FacturaCxP; canApprove?: boolean; onPagar?: () => void }) {
  const { motivoBloqueo } = useSodAprobacion();
  return <TooltipProvider><StatusActionBar factura={f} canEdit={false}
    puedeAprobar={canApprove && puedeAprobarFacturaProveedor(auth.effectiveRole)}
    motivoBloqueoAprobacion={motivoBloqueo(f.created_by)} flags={computeFacturaFlags(f, false)} onPagar={onPagar} />
  </TooltipProvider>;
}

beforeEach(() => { auth.effectiveRole = "contador"; mutation.isPending = false; });

describe("supplier-invoice self approval UI", () => {
  it("enables accountant own approval and opens the existing confirmation; no payment", () => {
    const pay = vi.fn();
    render(<Detail onPagar={pay} />);
    expect(screen.getByRole("button", { name: "Aprobar factura" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Aprobar factura" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Confirmar aprobación");
    expect(screen.queryByRole("button", { name: "Registrar pago" })).not.toBeInTheDocument();
    expect(pay).not.toHaveBeenCalled();
  });
  it("keeps own-invoice rejection available", () => {
    render(<Detail />);
    fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Confirmar rechazo");
  });
  it("keeps both actions disabled during an existing mutation", () => {
    mutation.isPending = true;
    render(<Detail />);
    expect(screen.getByRole("button", { name: "Aprobar factura" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeDisabled();
  });
  it.each(["auxiliar_contable", "tesorero", "vendedor"] as const)("does not add approval actions for %s", (role) => {
    auth.effectiveRole = role;
    render(<Detail />);
    expect(screen.queryByRole("button", { name: "Aprobar factura" })).not.toBeInTheDocument();
  });
  it("does not override an outer denied approval gate", () => {
    render(<Detail canApprove={false} />);
    expect(screen.queryByRole("button", { name: "Aprobar factura" })).not.toBeInTheDocument();
  });
  it.each([{ estado: "Cancelada" }, { estado_aprobacion: "aprobada" }, { estado_aprobacion: "rechazada" }] as const)("retains pending/noncancelled gate: %j", (state) => {
    render(<Detail f={{ ...invoice, ...state }} />);
    expect(screen.queryByRole("button", { name: "Aprobar factura" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Registrar pago" })).not.toBeInTheDocument();
  });
  it("batch select-all includes own and other invoices and excludes rows not supplied by the scoped query", () => {
    const rows = [invoice, { ...invoice, id: "other", created_by: "other-user" }];
    const setSelected = vi.fn();
    const { result } = renderHook(() => useColumnasPorAprobar({ rows, selected: new Set(), setSelected, seleccionEnLote: true }));
    expect(result.current.bloqueadosSod.size).toBe(0);
    const Header = result.current.columns[0].header as () => React.ReactNode;
    render(<Header />);
    expect(screen.getByRole("checkbox")).toBeEnabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(setSelected.mock.calls[0][0](new Set())).toEqual(new Set(["own", "other"]));
  });
  it("recomputes batch blocks when effective role loses approval access", () => {
    const { result, rerender } = renderHook(() => useSodAprobacion());
    expect(result.current.idsBloqueados([invoice]).size).toBe(0);
    auth.effectiveRole = "auxiliar_contable";
    rerender();
    expect(result.current.idsBloqueados([invoice])).toEqual(new Set(["own"]));
  });
});
