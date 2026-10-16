import type { KeyboardEvent, MouseEvent } from "react";
import type { NavigateFunction } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleRowClick, handleRowKeyDown } from "../rowNav";
const target = () => document.createElement("span");
function click(overrides: Partial<MouseEvent> = {}) {
  return { target: target(), button: 0, detail: 1, defaultPrevented: false, preventDefault: vi.fn(), ...overrides } as unknown as MouseEvent;
}
afterEach(() => vi.restoreAllMocks());
describe("rowNav: clic repetido y navegación accesible", () => {
  it("dos clics del mismo doble clic sólo navegan una vez, sin bloquear un clic nuevo", () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const options = { href: "/embarques/fixture", navigate };
    handleRowClick(click({ detail: 1 }), options);
    handleRowClick(click({ detail: 2 }), options);
    expect(navigate).toHaveBeenCalledTimes(1);
    handleRowClick(click({ detail: 1 }), options);
    expect(navigate).toHaveBeenCalledTimes(2);
  });
  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }])("conserva la apertura modificada %j incluso en clic repetido", (modifier) => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const navigate = vi.fn() as unknown as NavigateFunction;
    handleRowClick(click({ detail: 2, ...modifier }), { href: "/embarques/fixture", navigate });
    expect(open).toHaveBeenCalledWith("/embarques/fixture", "_blank", "noopener,noreferrer");
    expect(navigate).not.toHaveBeenCalled();
  });
  it.each([{ altKey: true }, { button: 2 }])("no cambia otros clics repetidos: %j", (modifier) => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    handleRowClick(click({ detail: 2, ...modifier }), { href: "/embarques/fixture", navigate });
    expect(navigate).toHaveBeenCalledWith("/embarques/fixture");
  });
  it.each(["Enter", " "])("conserva activación por teclado con %s", (key) => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    handleRowKeyDown({ target: target(), key, preventDefault: vi.fn() } as unknown as KeyboardEvent, { href: "/embarques/fixture", navigate });
    expect(navigate).toHaveBeenCalledWith("/embarques/fixture");
  });
  it("acepta clic de tecnología asistiva (detail 0) y respeta controles internos y preventDefault", () => {
    const navigate = vi.fn() as unknown as NavigateFunction;
    const options = { href: "/embarques/fixture", navigate };
    handleRowClick(click({ detail: 0 }), options);
    handleRowClick(click({ target: document.createElement("button") }), options);
    handleRowClick(click({ defaultPrevented: true }), options);
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
