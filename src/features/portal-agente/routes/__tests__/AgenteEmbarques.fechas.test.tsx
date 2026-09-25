import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AgenteEmbarques from "@/features/portal-agente/routes/AgenteEmbarques";

const embarquesMock = [
  {
    id: "f7e31d5a-1111-2222-3333-444444444444",
    expediente: null,
    modo: "Marítimo",
    estado: "En Tránsito",
    bl_master: null,
    puerto_origen: "Busan",
    puerto_destino: "Manzanillo",
    etd: "2026-09-28",
    eta: "2026-10-22",
  },
  {
    id: "a1b2c3d4-5555-6666-7777-888888888888",
    expediente: "EXP-12345",
    modo: "Aéreo",
    estado: "En Puerto",
    bl_master: "MASTER-999",
    puerto_origen: "Shanghái",
    puerto_destino: "Ensenada",
    etd: null,
    eta: null,
  },
];

vi.mock("@/features/portal-agente/hooks", () => ({
  useAgenteEmbarques: () => ({
    data: embarquesMock,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("AgenteEmbarques — formateo de fechas date-only (TZ México)", () => {
  it("muestra el día exacto de la fecha almacenada sin correrla por zona horaria", () => {
    render(<MemoryRouter><AgenteEmbarques /></MemoryRouter>);

    expect(screen.getByText("28/09/2026")).toBeInTheDocument();
    expect(screen.getByText("22/10/2026")).toBeInTheDocument();
  });

  it("no muestra el día anterior (regresión física confirmada)", () => {
    render(<MemoryRouter><AgenteEmbarques /></MemoryRouter>);

    expect(screen.queryByText("27/09/2026")).not.toBeInTheDocument();
    expect(screen.queryByText("21/10/2026")).not.toBeInTheDocument();
  });

  it("usa el guión como fallback cuando la fecha es nula", () => {
    render(<MemoryRouter><AgenteEmbarques /></MemoryRouter>);

    const guiones = screen.getAllByText("—");
    expect(guiones.length).toBeGreaterThanOrEqual(2);
  });
});
