/**
 * Q-08 — El banner de error no debe sobrevivir a un cambio de ruta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { RouteToastCleanup } from "../RouteToastCleanup";

const dismiss = vi.fn();
vi.mock("sonner", () => ({ toast: { dismiss: () => dismiss() } }));

function Navegar() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/otra"); }, [navigate]);
  return null;
}

describe("RouteToastCleanup", () => {
  beforeEach(() => dismiss.mockClear());

  it("descarta los toasts al cambiar de ruta", () => {
    render(
      <MemoryRouter initialEntries={["/inicio"]}>
        <RouteToastCleanup />
        <Routes>
          <Route path="/inicio" element={<Navegar />} />
          <Route path="/otra" element={<div>otra</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(dismiss).toHaveBeenCalled();
  });

  it("no descarta nada mientras la ruta no cambia", () => {
    render(
      <MemoryRouter initialEntries={["/inicio"]}>
        <RouteToastCleanup />
      </MemoryRouter>,
    );
    expect(dismiss).not.toHaveBeenCalled();
  });
});
