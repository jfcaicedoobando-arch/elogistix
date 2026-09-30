import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AgenteEmbarques from "../AgenteEmbarques";

vi.mock("@/features/portal-agente/hooks", () => ({
  useAgenteEmbarques: () => ({
    data: [{
      id: "e1", expediente: "ELIMP00008", modo: "Marítimo", tipo: "Importación",
      estado: "Confirmado", fecha_llegada_real: null, etd: "2026-09-28", eta: "2026-10-22",
      bl_master: null, puerto_origen: "Shanghái", puerto_destino: "Manzanillo",
    }],
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
}));

describe("AgenteEmbarques · estado consistente con Operaciones", () => {
  afterEach(() => vi.useRealTimers());

  it("muestra En Tránsito cuando el ETD ya ocurrió aunque el estado almacenado siga Confirmado", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T18:00:00Z"));
    render(<MemoryRouter><AgenteEmbarques /></MemoryRouter>);
    expect(screen.getByText("En Tránsito")).toBeInTheDocument();
    expect(screen.queryByText("Confirmado")).not.toBeInTheDocument();
  });
});
