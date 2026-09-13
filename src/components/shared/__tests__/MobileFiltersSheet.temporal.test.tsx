/**
 * v13.823.341 — la selección dentro del panel de filtros es temporal:
 * "Aplicar" y "Limpiar" la persisten; cerrar el panel la descarta.
 */
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileFiltersSheet } from "@/components/shared/MobileFiltersSheet";

function Host({ onRestore }: { onRestore: (v: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const [estado, setEstado] = useState("todos");
  return (
    <>
      <span data-testid="estado">{estado}</span>
      <MobileFiltersSheet
        open={open}
        onOpenChange={setOpen}
        activeCount={estado === "todos" ? 0 : 1}
        onClearAll={() => setEstado("todos")}
        snapshot={() => estado}
        restore={(foto) => {
          onRestore(foto);
          setEstado(foto as string);
        }}
      >
        <button type="button" onClick={() => setEstado("Borrador")}>
          Estado Borrador
        </button>
      </MobileFiltersSheet>
    </>
  );
}

describe("<MobileFiltersSheet /> selección temporal", () => {
  const abrirYSeleccionar = () => {
    fireEvent.click(screen.getByRole("button", { name: /filtros/i }));
    fireEvent.click(screen.getByRole("button", { name: /estado borrador/i }));
    expect(screen.getByTestId("estado")).toHaveTextContent("Borrador");
  };

  it("descarta la selección al cerrar el panel", () => {
    const onRestore = vi.fn();
    render(<Host onRestore={onRestore} />);
    abrirYSeleccionar();

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(onRestore).toHaveBeenCalledWith("todos");
    expect(screen.getByTestId("estado")).toHaveTextContent("todos");
  });

  it("conserva la selección al pulsar Aplicar", () => {
    const onRestore = vi.fn();
    render(<Host onRestore={onRestore} />);
    abrirYSeleccionar();

    fireEvent.click(screen.getByRole("button", { name: /^aplicar$/i }));

    expect(onRestore).not.toHaveBeenCalled();
    expect(screen.getByTestId("estado")).toHaveTextContent("Borrador");
  });
});
