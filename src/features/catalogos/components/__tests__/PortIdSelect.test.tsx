/**
 * Pasos verificados:
 * 1. Filtra por nombre, país y código UN/LOCODE.
 * 2. Devuelve el ID del puerto al seleccionarlo.
 * 3. Respeta `excludeId` y expone accesibilidad básica (combobox + aria-invalid).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/catalogos/hooks", () => ({
  usePuertos: () => ({ data: [] }),
}));

import { PortIdSelect } from "../PortIdSelect";
import { filtrarPuertos, etiquetaPuerto } from "../PortIdSelect.helpers";

const PUERTOS = [
  { id: "p1", name: "Rotterdam", country: "Países Bajos", code: "NLRTM" },
  { id: "p2", name: "Veracruz", country: "México", code: "MXVER" },
  { id: "p3", name: "Houston", country: "Estados Unidos", code: "USHOU" },
];

describe("PortIdSelect", () => {
  it("etiqueta cada puerto como Nombre, País (CÓDIGO)", () => {
    expect(etiquetaPuerto(PUERTOS[0])).toBe("Rotterdam, Países Bajos (NLRTM)");
  });

  it("filtra por nombre, país y código", () => {
    expect(filtrarPuertos(PUERTOS, "rotter").map((p) => p.id)).toEqual(["p1"]);
    expect(filtrarPuertos(PUERTOS, "méxico").map((p) => p.id)).toEqual(["p2"]);
    expect(filtrarPuertos(PUERTOS, "ushou").map((p) => p.id)).toEqual(["p3"]);
  });

  it("devuelve el ID al seleccionar y muestra el placeholder sin selección", () => {
    const onChange = vi.fn();
    render(
      <PortIdSelect value="" onChange={onChange} puertos={PUERTOS} placeholder="Buscar puerto de origen…" />,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Buscar puerto de origen…");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Houston, Estados Unidos (USHOU)"));
    expect(onChange).toHaveBeenCalledWith("p3");
  });

  it("excluye el puerto indicado en excludeId y marca aria-invalid", () => {
    render(
      <PortIdSelect value="" onChange={vi.fn()} puertos={PUERTOS} excludeId="p1" aria-invalid />,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(trigger);
    expect(screen.queryByText(/Rotterdam/)).not.toBeInTheDocument();
    expect(screen.getByText("Veracruz, México (MXVER)")).toBeInTheDocument();
  });
});
