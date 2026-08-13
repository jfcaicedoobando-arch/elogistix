/**
 * Regresión v13.544.2: `useDirtyGuard` usaba `useBlocker`, que sólo existe en
 * routers de datos. Bajo `<BrowserRouter>` lanzaba excepción y tumbaba el modal
 * de captura de facturas de proveedor.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useDirtyGuard } from "../useDirtyGuard";

function Sujeto({ dirty, accion }: { dirty: boolean; accion?: () => void }) {
  const { guardDialog, confirmarSalida } = useDirtyGuard(dirty);
  return (
    <div>
      <span>montado</span>
      <button type="button" onClick={() => confirmarSalida(accion ?? (() => {}))}>
        Atrás
      </button>
      {guardDialog}
    </div>
  );
}

describe("useDirtyGuard", () => {
  it("monta sin lanzar dentro de un BrowserRouter (sin router de datos)", () => {
    render(
      <BrowserRouter>
        <Sujeto dirty />
      </BrowserRouter>,
    );
    expect(screen.getByText("montado")).toBeInTheDocument();
  });

  it("no muestra el diálogo mientras no hay navegación interceptada", () => {
    render(
      <BrowserRouter>
        <Sujeto dirty />
      </BrowserRouter>,
    );
    expect(screen.queryByText("¿Salir sin guardar?")).not.toBeInTheDocument();
  });


  it("RFE-05: sin cambios, confirmarSalida ejecuta la acción sin diálogo", async () => {
    const accion = vi.fn();
    render(
      <BrowserRouter>
        <Sujeto dirty={false} accion={accion} />
      </BrowserRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(accion).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("¿Salir sin guardar?")).not.toBeInTheDocument();
  });

  it("RFE-05: con cambios pide confirmación antes de ejecutar", async () => {
    const accion = vi.fn();
    render(
      <BrowserRouter>
        <Sujeto dirty accion={accion} />
      </BrowserRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    await waitFor(() => expect(screen.getByText("¿Salir sin guardar?")).toBeInTheDocument());
    expect(accion).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));
    expect(accion).toHaveBeenCalledTimes(1);
  });

  it("RFE-05: cancelar deja la acción sin ejecutar", async () => {
    const accion = vi.fn();
    render(
      <BrowserRouter>
        <Sujeto dirty accion={accion} />
      </BrowserRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Atrás" }));
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    expect(accion).not.toHaveBeenCalled();
  });
});
