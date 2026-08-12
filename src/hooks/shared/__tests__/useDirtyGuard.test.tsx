/**
 * Regresión v13.544.2: `useDirtyGuard` usaba `useBlocker`, que sólo existe en
 * routers de datos. Bajo `<BrowserRouter>` lanzaba excepción y tumbaba el modal
 * de captura de facturas de proveedor.
 */
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useDirtyGuard } from "../useDirtyGuard";

function Sujeto({ dirty }: { dirty: boolean }) {
  const { guardDialog } = useDirtyGuard(dirty);
  return (
    <div>
      <span>montado</span>
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
});
