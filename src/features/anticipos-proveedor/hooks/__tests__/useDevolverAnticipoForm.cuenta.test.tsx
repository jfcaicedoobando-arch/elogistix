import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import type { AnticipoProveedorRow } from "../useAnticiposProveedor";
import { useDevolverAnticipoForm } from "../useDevolverAnticipoForm";
const mocks = vi.hoisted(() => ({ cuentas: [] as Tables<"cuentas_bancarias">[], devolver: vi.fn(), warning: vi.fn() }));
vi.mock("@/features/tesoreria/hooks", () => ({ useCuentasBancarias: () => ({ data: mocks.cuentas }) }));
vi.mock("@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations", () => ({ useDevolverAnticipo: () => ({ mutateAsync: mocks.devolver, isPending: false }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: mocks.warning }));
function cuenta(id: string, overrides: Partial<Tables<"cuentas_bancarias">> = {}): Tables<"cuentas_bancarias"> {
  return { id, organization_id: "org", alias: id, banco: "Banco", moneda: "MXN", activa: true,
    saldo_inicial: 0, fecha_saldo_inicial: "2026-10-03", numero_cuenta: "", clabe: "", notas: "",
    created_at: "2026-10-03T00:00:00Z", updated_at: "2026-10-03T00:00:00Z", deleted_at: null, deleted_by: null, ...overrides };
}
const anticipo: AnticipoProveedorRow = {
  id: "anticipo", organization_id: "org", proveedor_id: "proveedor", cuenta_bancaria_id: "original", moneda: "MXN",
  monto: 50, disponible: 50, saldo_disponible: 50, aplicado: 0, devuelto: 0, monto_devuelto: 0,
  fecha_anticipo: "2026-10-03", metodo_pago: "Transferencia", estado: "disponible", referencia: null,
  tipo_cambio_usd: null, notas: null, embarque_id: null, proveedor_nombre: "Proveedor", embarque_expediente: null,
  created_at: "2026-10-03T00:00:00Z", updated_at: "2026-10-03T00:00:00Z", created_by: null,
  deleted_at: null, deleted_by: null, devuelto_at: null, devuelto_by: null, motivo_cancelacion: null, motivo_devolucion: null,
};
beforeEach(() => { mocks.cuentas = []; mocks.devolver.mockReset().mockResolvedValue({}); mocks.warning.mockReset(); });
describe("Devolución: cuenta original y elección consciente", () => {
  it("propone la cuenta original incluso si el catálogo ordena otra primero", () => {
    mocks.cuentas = [cuenta("primera"), cuenta("original")];
    const { result } = renderHook(() => useDevolverAnticipoForm({ open: true, anticipo, onOpenChange: vi.fn() }));
    expect(result.current.cuentaId).toBe("original"); expect(result.current.otraCuenta).toBe(false);
  });
  it("espera el catálogo sin elegir silenciosamente otra cuenta", () => {
    const { result, rerender } = renderHook(() => useDevolverAnticipoForm({ open: true, anticipo, onOpenChange: vi.fn() }));
    expect(result.current.cuentaId).toBe("");
    mocks.cuentas = [cuenta("primera"), cuenta("original")]; rerender();
    expect(result.current.cuentaId).toBe("original");
  });
  it("otro anticipo de la misma cuenta propone su origen sin arrastrar la elección anterior", () => {
    mocks.cuentas = [cuenta("primera"), cuenta("original")];
    const { result, rerender } = renderHook(({ a }) => useDevolverAnticipoForm({ open: true, anticipo: a, onOpenChange: vi.fn() }), { initialProps: { a: anticipo } });
    act(() => result.current.setCuentaId("primera"));
    rerender({ a: { ...anticipo, id: "otro-anticipo" } });
    expect(result.current.cuentaId).toBe("original");
    expect(result.current.otraCuenta).toBe(false);
  });
  it.each([{ activa: false }, { deleted_at: "2026-10-03" }, { moneda: "USD" as const }])("exige elegir si la original no es compatible (%j)", (overrides) => {
    mocks.cuentas = [cuenta("primera"), cuenta("original", overrides)];
    const { result } = renderHook(() => useDevolverAnticipoForm({ open: true, anticipo, onOpenChange: vi.fn() }));
    expect(result.current.cuentaId).toBe(""); expect(result.current.cuentaValida).toBe(false);
  });
  it("preserva otra cuenta elegida al llegar la original o refrescar el anticipo", async () => {
    mocks.cuentas = [cuenta("elegida")];
    const { result, rerender } = renderHook(({ a }) => useDevolverAnticipoForm({ open: true, anticipo: a, onOpenChange: vi.fn() }), { initialProps: { a: anticipo } });
    act(() => { result.current.setCuentaId("elegida"); result.current.setMotivo("Reembolso"); });
    mocks.cuentas = [cuenta("primera"), cuenta("original"), cuenta("elegida")]; rerender({ a: { ...anticipo } });
    expect(result.current.cuentaId).toBe("elegida"); expect(result.current.otraCuenta).toBe(true);
    await act(async () => result.current.handleConfirm());
    expect(mocks.devolver).toHaveBeenCalledWith(expect.objectContaining({ cuentaBancariaId: "elegida", monto: 50 }));
  });
  it("no confirma una cuenta que dejó de estar disponible", async () => {
    mocks.cuentas = [cuenta("original")];
    const { result, rerender } = renderHook(() => useDevolverAnticipoForm({ open: true, anticipo, onOpenChange: vi.fn() }));
    act(() => result.current.setMotivo("Reembolso")); mocks.cuentas = []; rerender();
    await act(async () => result.current.handleConfirm());
    expect(mocks.devolver).not.toHaveBeenCalled(); expect(mocks.warning).toHaveBeenCalledOnce();
  });
});
