import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { useRef } from "react";
import { useScrollRestoreOnPathname } from "../useScrollRestoreOnPathname";

// jsdom no expone scrollTo en elementos; el hook ya tiene fallback, pero para
// espiar el caso feliz lo añadimos como no-op.
beforeAll(() => {
  if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.scrollTo) {
    HTMLElement.prototype.scrollTo = function scrollTo() { /* noop */ };
  }
});

function ScrollableHarness() {
  const mainRef = useRef<HTMLDivElement>(null);
  useScrollRestoreOnPathname(mainRef);
  const navigate = useNavigate();
  return (
    <div>
      <button onClick={() => navigate("/facturacion")}>Ir a facturación</button>
      <button onClick={() => navigate("/facturacion?tab=emitidas")}>
        Mismo path + query
      </button>
      <main ref={mainRef} data-testid="main" style={{ height: 2000 }} />
    </div>
  );
}

describe("useScrollRestoreOnPathname", () => {
  let mainScrollTo: ReturnType<typeof vi.spyOn>;
  let windowScrollTo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mainScrollTo = vi.spyOn(HTMLElement.prototype, "scrollTo").mockImplementation(() => {});
    windowScrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("restaura scroll al inicio del contenedor y de la ventana al cambiar de ruta", () => {
    render(
      <MemoryRouter initialEntries={["/crm/leads"]}>
        <ScrollableHarness />
      </MemoryRouter>,
    );

    // Efecto inicial al montar la ruta.
    expect(mainScrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
    expect(windowScrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });

    fireEvent.click(screen.getByRole("button", { name: /ir a facturación/i }));

    expect(mainScrollTo).toHaveBeenCalledTimes(2);
    expect(windowScrollTo).toHaveBeenCalledTimes(2);
    expect(mainScrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "instant" });
    expect(windowScrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "instant" });
  });

  it("no restaura scroll cuando solo cambian query params dentro de la misma ruta", () => {
    render(
      <MemoryRouter initialEntries={["/crm/leads"]}>
        <ScrollableHarness />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /ir a facturación/i }));
    const callsAfterRouteChange = mainScrollTo.mock.calls.length;
    const windowCallsAfterRouteChange = windowScrollTo.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /mismo path \+ query/i }));

    expect(mainScrollTo).toHaveBeenCalledTimes(callsAfterRouteChange);
    expect(windowScrollTo).toHaveBeenCalledTimes(windowCallsAfterRouteChange);
  });
});
