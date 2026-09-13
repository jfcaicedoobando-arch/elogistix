/**
 * Regresión: el clic central (auxclick) sobre un control interno de la fila
 * (botón "Acciones", checkbox, menú) no debe abrir el detalle en pestaña nueva.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { MouseEvent } from "react";
import { buildRowAuxClickHandler, type RowBehavior } from "../rowHandlers";

interface Item {
  id: string;
}

function behavior(over: Partial<RowBehavior<Item>> = {}): RowBehavior<Item> {
  return {
    item: { id: "1" },
    href: "/cotizaciones/1",
    seleccionable: false,
    navigable: true,
    toggleSelected: vi.fn(),
    navigate: vi.fn(),
    ...over,
  };
}

function evento(target: EventTarget | null, button = 1): MouseEvent {
  return { button, target, preventDefault: vi.fn() } as unknown as MouseEvent;
}

let openSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  openSpy = vi.fn(() => null);
  vi.stubGlobal("open", openSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("buildRowAuxClickHandler", () => {
  it("abre el detalle en pestaña nueva con clic central sobre la fila", () => {
    const celda = document.createElement("td");
    document.body.appendChild(celda);
    buildRowAuxClickHandler(behavior())(evento(celda));
    expect(openSpy).toHaveBeenCalledWith("/cotizaciones/1", "_blank", "noopener,noreferrer");
  });

  it("ignora el clic central sobre el botón Acciones", () => {
    const boton = document.createElement("button");
    document.body.appendChild(boton);
    buildRowAuxClickHandler(behavior())(evento(boton));
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("ignora el clic central sobre elementos marcados con data-no-row-nav", () => {
    const contenedor = document.createElement("div");
    contenedor.setAttribute("data-no-row-nav", "");
    const hijo = document.createElement("span");
    contenedor.appendChild(hijo);
    document.body.appendChild(contenedor);
    buildRowAuxClickHandler(behavior())(evento(hijo));
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("no hace nada si el botón no es el central", () => {
    const celda = document.createElement("td");
    document.body.appendChild(celda);
    buildRowAuxClickHandler(behavior())(evento(celda, 0));
    expect(openSpy).not.toHaveBeenCalled();
  });
});
