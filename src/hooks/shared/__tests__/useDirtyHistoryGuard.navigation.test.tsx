// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router";
import { useState } from "react";
import { useDirtyGuard } from "../useDirtyGuard";
import { registerDirtyHistoryGuard } from "@/lib/bootstrap/dirtyHistoryGuard";

// The dispatcher must subscribe before BrowserRouter, as it does in main.tsx.
registerDirtyHistoryGuard();

function Capture({ dirty }: { dirty: boolean }) {
  const [folio, setFolio] = useState("AUD2-UX-BACK-0310");
  const { guardDialog } = useDirtyGuard(dirty, true);
  return <>
    <input aria-label="Folio en captura" value={folio} onChange={event => setFolio(event.target.value)} />
    {guardDialog}
  </>;
}

function RouterFixture({ dirty = true }: { dirty?: boolean }) {
  return <BrowserRouter><Routes>
    <Route path="/capture" element={<Capture dirty={dirty} />} />
    <Route path="/target" element={<p>Destino de historial</p>} />
  </Routes></BrowserRouter>;
}

// Control the traversal events independently of jsdom's asynchronous history
// queue, so a second browser request can arrive before the restore completes.
function popTo(index: number, path: "/capture" | "/target") {
  act(() => {
    window.history.replaceState({ idx: index }, "", path);
    window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: index } }));
  });
}

function startCapture() {
  window.history.replaceState({ idx: 10 }, "", "/capture");
  const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
  const push = vi.spyOn(window.history, "pushState");
  const view = render(<RouterFixture />);
  return { go, push, view };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("dirty history traversal lifecycle", () => {
  it.each([-2, -1, 1, 2])("guards delta %i, preserves capture on continue and leaves once on discard", delta => {
    const { go, push } = startCapture();
    fireEvent.change(screen.getByRole("textbox", { name: "Folio en captura" }), {
      target: { value: "AUD2-UX-BACK-0310 editado" },
    });

    popTo(10 + delta, "/target");
    expect(go).toHaveBeenLastCalledWith(-delta);
    expect(screen.queryByText("Destino de historial")).not.toBeInTheDocument();
    popTo(10, "/capture");
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    expect(screen.getByRole("textbox", { name: "Folio en captura" })).toHaveValue("AUD2-UX-BACK-0310 editado");

    popTo(10 + delta, "/target");
    popTo(10, "/capture");
    fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));
    expect(go).toHaveBeenCalledTimes(3);
    expect(go).toHaveBeenLastCalledWith(delta);
    popTo(10 + delta, "/target");
    expect(screen.getByText("Destino de historial")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Folio en captura" })).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the first pending destination when a second traversal interrupts restoration", () => {
    const { go, push } = startCapture();
    popTo(9, "/target");
    popTo(8, "/target");
    expect(go).toHaveBeenCalledExactlyOnceWith(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Folio en captura" })).toHaveValue("AUD2-UX-BACK-0310");

    popTo(10, "/capture");
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));
    expect(go).toHaveBeenLastCalledWith(-1);
    popTo(9, "/target");
    expect(screen.getByText("Destino de historial")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("repeated back and forward requests after continuing do not accumulate entries", () => {
    const { go, push } = startCapture();
    for (const delta of [-1, 1, -1, 1]) {
      popTo(10 + delta, "/target");
      popTo(10, "/capture");
      fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: "Folio en captura" })).toHaveValue("AUD2-UX-BACK-0310");
    }
    expect(go.mock.calls).toEqual([[1], [-1], [1], [-1]]);
    expect(push).not.toHaveBeenCalled();
  });

  it("releases interception if capture becomes clean while restoration is pending", () => {
    const { go, view } = startCapture();
    popTo(9, "/target");
    view.rerender(<RouterFixture dirty={false} />);
    popTo(10, "/capture");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    popTo(9, "/target");
    expect(screen.getByText("Destino de historial")).toBeInTheDocument();
    expect(go).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("releases interception when the form unmounts with a restore pending", () => {
    const { go, view } = startCapture();
    popTo(9, "/target");
    view.unmount();
    const laterListener = vi.fn();
    window.addEventListener("popstate", laterListener);
    try {
      popTo(10, "/capture");
      popTo(9, "/target");
      expect(laterListener).toHaveBeenCalledTimes(2);
      expect(go).toHaveBeenCalledExactlyOnceWith(1);
    } finally {
      window.removeEventListener("popstate", laterListener);
    }
  });
});
