import { describe, expect, it } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useDesbordamientoVertical } from "../useDesbordamientoVertical";

function Caja({ scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number }) {
  const { ref, estado } = useDesbordamientoVertical<HTMLDivElement>();
  return (
    <div
      ref={(el) => {
        if (!el) return;
        Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
        Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
        // El test necesita inyectar el nodo con medidas simuladas; la regla del
        // compilador no aplica a este ref de prueba.
        // eslint-disable-next-line react-compiler/react-compiler
        ref.current = el;
      }}
      data-testid="caja"
    >
      <span data-testid="arriba">{String(estado.hayArriba)}</span>
      <span data-testid="abajo">{String(estado.hayAbajo)}</span>
    </div>
  );
}

describe("useDesbordamientoVertical", () => {
  it("marca contenido oculto abajo cuando el contenido excede el área visible", async () => {
    render(<Caja scrollHeight={800} clientHeight={500} />);
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("abajo").textContent).toBe("true");
    expect(screen.getByTestId("arriba").textContent).toBe("false");
  });

  it("no marca desbordamiento cuando todo cabe", async () => {
    render(<Caja scrollHeight={500} clientHeight={500} />);
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("abajo").textContent).toBe("false");
    expect(screen.getByTestId("arriba").textContent).toBe("false");
  });

  it("marca contenido oculto arriba al desplazarse", async () => {
    render(<Caja scrollHeight={800} clientHeight={500} />);
    const caja = screen.getByTestId("caja");
    caja.scrollTop = 200;
    await act(async () => {
      caja.dispatchEvent(new Event("scroll"));
    });
    expect(screen.getByTestId("arriba").textContent).toBe("true");
    expect(screen.getByTestId("abajo").textContent).toBe("true");
  });
});
