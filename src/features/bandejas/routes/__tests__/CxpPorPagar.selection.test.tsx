import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { CxpPorPagarDialogs } from "../_sections/CxpPorPagarDialogs";
import CxpPorPagar from "../CxpPorPagar";

const fixture = vi.hoisted(() => ({
  programar: vi.fn(async () => undefined),
  rows: ["synthetic-a", "synthetic-b", "synthetic-c"].map((id, index) => ({
    factura_id: id, proveedor_id: "synthetic-provider", proveedor_nombre: "Proveedor sintetico",
    proveedor_origen: "agente", folio_proveedor: `SYN-${index + 1}`, embarque_id: null,
    expediente: null, fecha_emision: null, fecha_vencimiento: null, dias_para_vencer: index,
    moneda: "MXN", total: 100, pagado: 0, saldo: 100, estado_captura: "Aprobada",
    tipo_cambio_usd: null, fecha_programada_pago: null,
  })),
}));

// Keep the route, URL filters/pagination, its own columns, DataTable and Radix
// real. Isolate data/actions, the admin permission, viewport and dialog shell.
vi.mock("@/features/bandejas/hooks/useBandejas", () => ({
  useCxpPorPagar: () => ({ data: fixture.rows, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/features/cxp/hooks", () => ({
  useProgramarPagoLote: () => ({ programar: fixture.programar, isRunning: false, progreso: null }),
}));
vi.mock("@/hooks/shared/usePermissions", () => ({ usePermissions: () => ({ canPagarProveedor: true }) }));
vi.mock("@/hooks/shared", async () => ({
  useIsMobile: () => false,
  ...await import("@/hooks/shared/useCargaExpirada"),
}));
vi.mock("../_sections/CxpPorPagarDialogs", () => ({
  CxpPorPagarDialogs: ({ isDialogOpen, onConfirmarProgramar }: ComponentProps<typeof CxpPorPagarDialogs>) =>
    isDialogOpen ? <button onClick={onConfirmarProgramar}>Confirmar programacion simulada</button> : null,
}));

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function show() {
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Synthetic selection test must not access network"); }));
  return render(
    <NuqsTestingAdapter hasMemory>
      <MemoryRouter initialEntries={["/compras/por-pagar"]}>
        <CxpPorPagar />
        <Location />
      </MemoryRouter>
    </NuqsTestingAdapter>,
  );
}

function checkboxFor(folio: string) {
  return within(screen.getByText(folio).closest("tr")!).getByRole("checkbox", { name: "Seleccionar fila" });
}

function expectCount(count: number) {
  if (count === 0) {
    expect(screen.queryByRole("button", { name: /Programar pago/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pagar en lote/ })).not.toBeInTheDocument();
    return;
  }
  expect(screen.getByRole("button", { name: `Programar pago (${count})` })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: `Pagar en lote (${count})` })).toBeInTheDocument();
}

function expectNoNavigationOrNetwork() {
  expect(screen.getByTestId("location")).toHaveTextContent(/^\/compras\/por-pagar$/);
  expect(fetch).not.toHaveBeenCalled();
}

describe("CxP Por pagar: seleccion de facturas", () => {
  it("anuncia parcial, todas y ninguna conservando el contador real sin navegar", () => {
    show();
    const master = screen.getByRole("checkbox", { name: "Seleccionar todos" });
    expect(master).toHaveAttribute("aria-checked", "false");
    expectCount(0);

    fireEvent.click(checkboxFor("SYN-1"));
    expect(checkboxFor("SYN-1")).toHaveAttribute("aria-checked", "true");
    expect(checkboxFor("SYN-2")).toHaveAttribute("aria-checked", "false");
    expect(checkboxFor("SYN-3")).toHaveAttribute("aria-checked", "false");
    expectCount(1);
    expect(screen.getByRole("button", { name: "Pagar en lote (1)" })).toBeDisabled();
    expect(master).toHaveAttribute("aria-checked", "mixed");
    expectNoNavigationOrNetwork();

    fireEvent.click(master);
    expectCount(3);
    expect(master).toHaveAttribute("aria-checked", "true");
    for (const folio of ["SYN-1", "SYN-2", "SYN-3"]) expect(checkboxFor(folio)).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Pagar en lote (3)" })).toBeEnabled();
    expectNoNavigationOrNetwork();

    fireEvent.click(master);
    expect(master).toHaveAttribute("aria-checked", "false");
    expectCount(0);
    for (const folio of ["SYN-1", "SYN-2", "SYN-3"]) expect(checkboxFor(folio)).toHaveAttribute("aria-checked", "false");
    expect(fixture.programar).not.toHaveBeenCalled();
    expectNoNavigationOrNetwork();
  });

  it("envia exclusivamente los IDs de factura seleccionados al servicio simulado", async () => {
    show();
    fireEvent.click(checkboxFor("SYN-3"));
    fireEvent.click(checkboxFor("SYN-1"));
    expectCount(2);
    expect(checkboxFor("SYN-2")).toHaveAttribute("aria-checked", "false");
    expectNoNavigationOrNetwork();

    fireEvent.click(screen.getByRole("button", { name: "Programar pago (2)" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar programacion simulada" }));
    expect(fixture.programar).toHaveBeenCalledExactlyOnceWith(
      ["synthetic-c", "synthetic-a"], expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: /Programar pago/ })).not.toBeInTheDocument());
    expectCount(0);
    expect(screen.getByRole("checkbox", { name: "Seleccionar todos" })).toHaveAttribute("aria-checked", "false");
    for (const folio of ["SYN-1", "SYN-2", "SYN-3"]) expect(checkboxFor(folio)).toHaveAttribute("aria-checked", "false");
    expectNoNavigationOrNetwork();
  });
});
