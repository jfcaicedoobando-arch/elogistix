import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { FacturaDetalle } from "../../../types/detalle";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ recuperar: vi.fn().mockResolvedValue({ outcome: "sin_cambios" }), invalidate: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock("@/features/facturacion/services/claimPending", () => ({ recuperarClaimFactura: mocks.recuperar, recuperarClaimNotaCredito: mocks.recuperar }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyInfo: vi.fn(), notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/components/shared/Hint", () => ({ Hint: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("../FacturaSaldoResidualAlert", () => ({ FacturaSaldoResidualAlert: () => null }));
vi.mock("../CancelacionEnTramiteBanner", () => ({ CancelacionEnTramiteBanner: () => null }));
vi.mock("../SustitutaCanceladaBanner", () => ({ SustitutaCanceladaBanner: () => null }));
import { FacturaDetalleBanners } from "../FacturaDetalleBanners";

const factura = (deleted_at?: string | null) => ({ id: "f1", deleted_at, estado: "Borrador", facturapi_id: "PENDING:claim", facturapi_claim_at: "2026-01-01T00:00:00Z" }) as FacturaDetalle;

describe("recuperación de claim en detalle histórico", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["2026-10-10T10:00:00Z", undefined])("al pasar de vigente a %s no ofrece recuperación", (deleted_at) => {
    const { rerender } = render(<FacturaDetalleBanners factura={factura(null)} />);
    expect(screen.getByRole("button", { name: "Verificar y recuperar" })).toBeTruthy();
    rerender(<FacturaDetalleBanners factura={factura(deleted_at)} />);
    expect(screen.queryByRole("button", { name: "Verificar y recuperar" })).toBeNull();
    expect(screen.getByText("Timbrado en proceso interrumpido")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("operaciones deshabilitadas");
    expect(mocks.recuperar).not.toHaveBeenCalled();
  });
  it("vigente conserva recuperación", async () => {
    render(<FacturaDetalleBanners factura={factura(null)} />);
    fireEvent.click(screen.getByRole("button", { name: "Verificar y recuperar" }));
    await waitFor(() => expect(mocks.recuperar).toHaveBeenCalledWith("f1"));
  });
});
