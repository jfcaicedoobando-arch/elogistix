import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FuenteEerrToggle } from "../FuenteEerrToggle";
import { safeLocalStorage, STORAGE_KEYS } from "@/lib/browserStorage";

describe("FuenteEerrToggle", () => {
  beforeEach(() => {
    safeLocalStorage.removeItem(STORAGE_KEYS.eerrFuente);
  });

  it("renderiza ambas opciones y marca 'embarques' por default", () => {
    render(<FuenteEerrToggle />);
    const embarques = screen.getByRole("radio", { name: /operativa/i });
    const facturas = screen.getByRole("radio", { name: /devengada/i });
    expect(embarques).toHaveAttribute("data-state", "on");
    expect(facturas).toHaveAttribute("data-state", "off");
  });

  it("cambiar a 'facturas' actualiza estado y persiste en localStorage", () => {
    render(<FuenteEerrToggle />);
    fireEvent.click(screen.getByRole("radio", { name: /devengada/i }));
    expect(safeLocalStorage.getItem(STORAGE_KEYS.eerrFuente)).toBe("facturas");
    expect(screen.getByRole("radio", { name: /devengada/i })).toHaveAttribute("data-state", "on");
  });

  it("acepta aria-label custom", () => {
    const { container } = render(<FuenteEerrToggle ariaLabel="Selector custom" />);
    // Radix ToggleGroup expone aria-label en el root; role interno puede
    // variar. Validamos por el atributo directamente.
    expect(container.querySelector('[aria-label="Selector custom"]')).not.toBeNull();
  });
});
