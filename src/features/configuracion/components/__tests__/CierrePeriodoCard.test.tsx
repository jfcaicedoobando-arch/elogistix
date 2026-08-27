import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CierrePeriodoCard from "../CierrePeriodoCard";

const mutate = vi.fn();
let valorGuardado = "";

vi.mock("@/features/configuracion/hooks/useConfiguracion", () => ({
  useConfigValue: () => valorGuardado,
  useUpdateConfiguracion: () => ({ mutate, isPending: false }),
}));

describe("CierrePeriodoCard", () => {
  beforeEach(() => {
    mutate.mockClear();
    valorGuardado = "";
  });

  it("sin cierre configurado no muestra aviso ni botón de reapertura", () => {
    render(<CierrePeriodoCard />);
    expect(screen.getByText("Cierre de periodo contable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reabrir periodo/i })).toBeNull();
  });

  it("con cierre configurado avisa y permite reabrir guardando vacío", () => {
    valorGuardado = "2026-01-31";
    render(<CierrePeriodoCard />);
    expect(screen.getByText("2026-01-31")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reabrir periodo/i }));
    expect(mutate).toHaveBeenCalledWith([
      { categoria: "contabilidad", clave: "cierre_periodo_fecha", valor: "" },
    ]);
  });
});
