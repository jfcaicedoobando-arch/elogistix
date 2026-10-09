import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const rows = vi.hoisted(() => [
  { id: "hoy", numero: "Hoy", saldo: .01, moneda: "MXN", estatus_cobranza: "Por vencer" },
  { id: "mañana", numero: "Mañana", saldo: .01, moneda: "MXN", estatus_cobranza: "Vigente" },
  { id: "ayer", numero: "Ayer", saldo: .01, moneda: "MXN", estatus_cobranza: "Vencida" },
  { id: "ruido", numero: "Ruido", saldo: .0049, moneda: "MXN", estatus_cobranza: "Sin saldo" },
]);
vi.mock("@/features/facturacion/hooks/useCobranza", () => ({ useCobranza: () => ({ data: rows, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock("@/hooks/shared/useClientPagedList", () => ({ useClientPagedList: ({ data }: { data: typeof rows }) => ({ rows: data, filteredCount: data.length, filters: { moneda: "todas" } }) }));
vi.mock("../BandejaShell", () => ({ BandejaShell: ({ children, counter }: { children: ReactNode; counter: ReactNode }) => <>{counter}{children}</> }));
vi.mock("@/components/shared/dataTable/ResponsiveDataTable", () => ({ ResponsiveDataTable: ({ data }: { data: typeof rows }) => <ul>{data.map((r) => <li key={r.id}>{r.numero}</li>)}</ul> }));
import { BandejaPorCobrar } from "../BandejaPorCobrar";

describe("AUD54: lista Por cobrar y contador monetario", () => {
  it("retiene los centavos de hoy/mañana, sin vencidas ni residuo que redondea a cero", () => {
    render(<BandejaPorCobrar />);
    expect(screen.getAllByRole("listitem").map((x) => x.textContent)).toEqual(["Hoy", "Mañana"]);
    expect(screen.getByText("2", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByText("Ayer")).toBeNull();
    expect(screen.queryByText("Ruido")).toBeNull();
  });
});
