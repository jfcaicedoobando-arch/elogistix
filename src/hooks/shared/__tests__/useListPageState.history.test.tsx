// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, Link } from "react-router";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { useListPageState } from "../useListPageState";

function ListFixture() {
  const state = useListPageState({ estado: "todos" }, 100, [50, 100, 200, 500]);
  return <>
    <output data-testid="list-state">{JSON.stringify({
      page: state.page,
      pageSize: state.pageSize,
      search: state.search,
      estado: state.filters.estado,
    })}</output>
    <button type="button" onClick={() => state.setPage(3)}>Página 4</button>
    <Link to="/listado?page=5&ps=500&estado=Pendiente&view=detalle">Otro listado</Link>
  </>;
}

function readState() {
  return JSON.parse(screen.getByTestId("list-state").textContent ?? "{}");
}

function mountList(url: string) {
  // BrowserRouter recibe el mismo estado inicial que mantiene en la aplicación.
  window.history.replaceState({ idx: 0, key: "initial", usr: null }, "", url);
  const push = vi.spyOn(window.history, "pushState");
  const replace = vi.spyOn(window.history, "replaceState");
  const view = render(<BrowserRouter><NuqsAdapter><ListFixture /></NuqsAdapter></BrowserRouter>);
  return { ...view, push, replace };
}

async function traverse(direction: "back" | "forward") {
  act(() => window.history[direction]());
}

describe("useListPageState con BrowserRouter y NuqsAdapter reales", () => {
  it("conserva URLs válidas y restaura page, ps y filtros con Atrás/Adelante", async () => {
    const initialUrl = "/listado?q=acero&page=2&ps=200&estado=Pagada&view=detalle";
    const { push, replace } = mountList(initialUrl);
    try {
      expect(readState()).toEqual({ page: 2, pageSize: 200, search: "acero", estado: "Pagada" });
      expect(window.location.pathname + window.location.search).toBe(initialUrl);
      expect(push).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Página 4" }));
      await waitFor(() => expect(new URLSearchParams(window.location.search).get("page")).toBe("3"));
      expect(readState()).toEqual({ page: 3, pageSize: 200, search: "acero", estado: "Pagada" });
      expect(new URLSearchParams(window.location.search).get("view")).toBe("detalle");
      const previousUrl = window.location.pathname + window.location.search;

      fireEvent.click(screen.getByRole("link", { name: "Otro listado" }));
      await waitFor(() => expect(readState()).toEqual({ page: 5, pageSize: 500, search: "", estado: "Pendiente" }));

      await traverse("back");
      await waitFor(() => expect(readState()).toEqual({ page: 3, pageSize: 200, search: "acero", estado: "Pagada" }));
      expect(window.location.pathname + window.location.search).toBe(previousUrl);

      await traverse("forward");
      await waitFor(() => expect(readState()).toEqual({ page: 5, pageSize: 500, search: "", estado: "Pendiente" }));
      expect(new URLSearchParams(window.location.search).get("ps")).toBe("500");
    } finally {
      push.mockRestore();
      replace.mockRestore();
    }
  });

  it("normaliza una entrada inválida al volver sin reescribir ni perder el historial", async () => {
    const invalidUrl = "/listado?page=-2&ps=0&estado=Pagada&view=detalle";
    const { push, replace } = mountList(invalidUrl);
    try {
      expect(readState()).toEqual({ page: 0, pageSize: 100, search: "", estado: "Pagada" });
      expect(window.location.pathname + window.location.search).toBe(invalidUrl);
      expect(push).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("link", { name: "Otro listado" }));
      await waitFor(() => expect(readState().pageSize).toBe(500));
      const writesBeforeTraversal = push.mock.calls.length + replace.mock.calls.length;

      await traverse("back");
      await waitFor(() => expect(readState()).toEqual({ page: 0, pageSize: 100, search: "", estado: "Pagada" }));
      expect(window.location.pathname + window.location.search).toBe(invalidUrl);
      expect(push.mock.calls.length + replace.mock.calls.length).toBe(writesBeforeTraversal);

      await traverse("forward");
      await waitFor(() => expect(readState()).toEqual({ page: 5, pageSize: 500, search: "", estado: "Pendiente" }));
      expect(push.mock.calls.length + replace.mock.calls.length).toBe(writesBeforeTraversal);
    } finally {
      push.mockRestore();
      replace.mockRestore();
    }
  });
});
