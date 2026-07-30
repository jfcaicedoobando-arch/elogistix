/**
 * Q-08 — El banner de ERROR no debe sobrevivir a un cambio de ruta, pero las
 * confirmaciones de éxito sí (el usuario debe alcanzar a leerlas tras un
 * redirect).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { RouteToastCleanup } from "../RouteToastCleanup";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

const dismiss = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    dismiss: (id?: string) => dismiss(id),
  }),
}));

function Navegar() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/otra"); }, [navigate]);
  return null;
}

function renderConNavegacion() {
  render(
    <MemoryRouter initialEntries={["/inicio"]}>
      <RouteToastCleanup />
      <Routes>
        <Route path="/inicio" element={<Navegar />} />
        <Route path="/otra" element={<div>otra</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RouteToastCleanup", () => {
  beforeEach(() => dismiss.mockClear());

  it("descarta los toasts de error al cambiar de ruta", () => {
    notifyError(undefined, { title: "Falló la carga", errorCode: "TEST" });
    renderConNavegacion();
    expect(dismiss).toHaveBeenCalledWith("err-TEST");
  });

  it("no descarta los toasts de éxito", () => {
    notifySuccess(undefined, { title: "Guardado correctamente" });
    renderConNavegacion();
    expect(dismiss).not.toHaveBeenCalled();
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
