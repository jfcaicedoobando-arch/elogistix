// @vitest-environment jsdom
import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as dispatcher from "@/lib/bootstrap/dirtyHistoryGuard";
import { useDirtyGuard } from "../useDirtyGuard";

dispatcher.registerDirtyHistoryGuard();
type Guard = ReturnType<typeof useDirtyGuard>;

function Capture({ report, dirty, history }: {
  report: (guard: Guard) => void; dirty: boolean; history: boolean;
}) {
  const guard = useDirtyGuard(dirty, history);
  useEffect(() => report(guard), [guard, report]);
  return <>
    <input aria-label="Folio" defaultValue="AUD2-UX-BACK-0310" />
    <a href="/target">Ir a proformas</a>
    {guard.guardDialog}
  </>;
}

function Fixture({ report, dirty = true, history = true }: {
  report: (guard: Guard) => void; dirty?: boolean; history?: boolean;
}) {
  return <BrowserRouter><Routes>
    <Route path="/capture" element={<Capture report={report} dirty={dirty} history={history} />} />
    <Route path="/target" element={<p>Proformas</p>} />
  </Routes></BrowserRouter>;
}

function pop(index: number, path = "/target") {
  window.history.replaceState({ idx: index }, "", path);
  window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: index } }));
}

function mount(history = true) {
  window.history.replaceState({ idx: 10 }, "", "/capture");
  const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
  const push = vi.spyOn(window.history, "pushState");
  const subscribe = vi.spyOn(dispatcher, "subscribeDirtyHistoryGuard");
  let latest: Guard;
  const report = (guard: Guard) => { latest = guard; };
  const view = render(<Fixture report={report} history={history} />);
  return { go, push, subscribe, view, report, current: () => latest! };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("coordination before the navigation alert commits", () => {
  it.each([-1, 1])("blocks a stale close callback synchronously during delta %i and keeps the subscription", delta => {
    const { go, push, subscribe, current } = mount();
    const isCloseBlocked = current().isCloseBlocked;
    expect(isCloseBlocked()).toBe(false);
    fireEvent.change(screen.getByRole("textbox", { name: "Folio" }), {
      target: { value: "AUD2-UX-BACK-0310 editado" },
    });

    act(() => {
      pop(10 + delta);
      // This callback belongs to the render before popstate. The ref must
      // protect it before React can expose isNavigating or mount the alert.
      expect(isCloseBlocked()).toBe(true);
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(current().isNavigating).toBe(true);
    expect(current().isConfirming).toBe(false);
    expect(current().isCloseBlocked).toBe(isCloseBlocked);
    expect(go).toHaveBeenCalledExactlyOnceWith(-delta);

    act(() => {
      pop(10, "/capture");
      // The restored phase hands off to the pending confirmation without
      // releasing the synchronous blocker between those two states.
      expect(isCloseBlocked()).toBe(true);
    });
    expect(current().isConfirming).toBe(true);
    expect(current().isNavigating).toBe(true);
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    expect(isCloseBlocked()).toBe(false);
    expect(current().isNavigating).toBe(false);
    expect(screen.getByRole("textbox", { name: "Folio" })).toHaveValue("AUD2-UX-BACK-0310 editado");

    act(() => { pop(10 + delta); pop(10, "/capture"); });
    fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));
    expect(go.mock.calls).toEqual([[-delta], [-delta], [delta]]);
    act(() => pop(10 + delta));
    expect(screen.getByText("Proformas")).toBeInTheDocument();
    expect(isCloseBlocked()).toBe(false);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("marks an intercepted link synchronously and releases after continuing, with history opt-in disabled", () => {
    const { current, go, subscribe } = mount(false);
    const isCloseBlocked = current().isCloseBlocked;
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Ir a proformas" }));
      expect(isCloseBlocked()).toBe(true);
    });
    expect(current().isConfirming).toBe(true);
    expect(current().isNavigating).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    expect(isCloseBlocked()).toBe(false);
    expect(current().isNavigating).toBe(false);
    expect(window.location.pathname).toBe("/capture");
    expect(screen.getByRole("textbox", { name: "Folio" })).toHaveValue("AUD2-UX-BACK-0310");
    expect(go).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("releases restoration on dirty=false without recreating a guard for render-only state changes", () => {
    const { current, report, subscribe, view } = mount();
    const isCloseBlocked = current().isCloseBlocked;
    act(() => pop(9));
    expect(isCloseBlocked()).toBe(true);
    expect(subscribe).toHaveBeenCalledTimes(1);
    view.rerender(<Fixture report={report} dirty={false} />);
    expect(isCloseBlocked()).toBe(false);
    expect(current().isNavigating).toBe(false);
    act(() => pop(10, "/capture"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it.each(["restoring", "confirming"])("releases synchronous blocker when unmounting while %s", phase => {
    const { current, view } = mount();
    const isCloseBlocked = current().isCloseBlocked;
    act(() => pop(9));
    if (phase === "confirming") act(() => pop(10, "/capture"));
    expect(isCloseBlocked()).toBe(true);
    view.unmount();
    expect(isCloseBlocked()).toBe(false);
  });
});
