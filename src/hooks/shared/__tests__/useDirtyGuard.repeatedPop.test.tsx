// @vitest-environment jsdom
import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as dispatcher from "@/lib/bootstrap/dirtyHistoryGuard";
import { useDirtyGuard } from "../useDirtyGuard";

// Match bootstrap: the dispatcher receives POP before BrowserRouter.
dispatcher.registerDirtyHistoryGuard();
type Guard = ReturnType<typeof useDirtyGuard>;
type Choice = "Confirmar" | "Seguir capturando" | "Escape";
const network = vi.fn(() => { throw new Error("Unexpected network access in capture regression"); });
const folio = "AUD2-UX-BACK-0310";

function Capture({ report }: { report: (guard: Guard) => void }) {
  const [value, setValue] = useState(folio);
  const guard = useDirtyGuard(true, true);
  useEffect(() => report(guard), [guard, report]);
  return <>
    <input aria-label="Folio en captura" value={value} onChange={event => setValue(event.target.value)} />
    {guard.guardDialog}
  </>;
}

function Fixture({ report }: { report: (guard: Guard) => void }) {
  return <BrowserRouter><Routes>
    <Route path="/capture" element={<Capture report={report} />} />
    <Route path="/target" element={<p>Destino de historial</p>} />
  </Routes></BrowserRouter>;
}

function pop(index: number, path: "/capture" | "/target") {
  window.history.replaceState({ idx: index }, "", path);
  window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: index } }));
}

function mount() {
  vi.stubGlobal("fetch", network);
  window.history.replaceState({ idx: 10 }, "", "/capture");
  const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
  const push = vi.spyOn(window.history, "pushState");
  const subscribe = vi.spyOn(dispatcher, "subscribeDirtyHistoryGuard");
  let latest: Guard;
  const report = (guard: Guard) => { latest = guard; };
  render(<Fixture report={report} />);
  return { go, push, subscribe, current: () => latest! };
}

afterEach(() => {
  expect(network).not.toHaveBeenCalled();
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("dirty guard: a second POP while its confirmation is already open", () => {
  it.each([-1, 1].flatMap(delta => (["Confirmar", "Seguir capturando", "Escape"] as const)
    .map(choice => ({ delta, choice }))))(
    "delta $delta: stale $choice cannot choose before restoration or lose the pending action",
    ({ delta, choice }: { delta: number; choice: Choice }) => {
      const { go, push, subscribe, current } = mount();
      fireEvent.change(screen.getByRole("textbox", { name: "Folio en captura" }), {
        target: { value: `${folio} editado` },
      });

      // The first POP finishes restoring and leaves one actionable alert.
      act(() => { pop(10 + delta, "/target"); pop(10, "/capture"); });
      expect(go.mock.calls).toEqual([[-delta]]);
      expect(screen.getAllByRole("alertdialog", { hidden: true })).toHaveLength(1);
      const oldConfirm = screen.getByRole("button", { name: "Salir sin guardar" });
      const oldCancel = screen.getByRole("button", { name: "Seguir capturando" });
      const oldCloseBlocked = current().isCloseBlocked;
      expect(oldConfirm).not.toBeDisabled();
      expect(oldCancel).not.toBeDisabled();

      let injected = false;
      go.mockImplementation(steps => {
        if (injected || steps !== -delta) return;
        injected = true;
        // The second POP has set its synchronous restoring ref, but React
        // has not rendered disabled buttons. These handlers are from the
        // first alert and must already refuse a choice from the wrong index.
        expect(oldCloseBlocked()).toBe(true);
        expect(oldConfirm).toBeInTheDocument();
        expect(oldConfirm).not.toBeDisabled();
        expect(oldCancel).not.toBeDisabled();
        if (choice === "Escape") fireEvent.keyDown(document.body, { key: "Escape" });
        else fireEvent.click(choice === "Confirmar" ? oldConfirm : oldCancel);
      });

      act(() => pop(10 + delta, "/target"));
      expect(injected).toBe(true);
      // No leaving traversal may start while the restoration is pending.
      expect(go.mock.calls).toEqual([[-delta], [-delta]]);
      expect(current().isConfirming).toBe(true);
      expect(current().isNavigating).toBe(true);
      expect(screen.getAllByRole("alertdialog", { hidden: true })).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Seguir capturando" })).toBeDisabled();
      const pendingAction = screen.getByRole("alertdialog").querySelectorAll("button");
      expect(pendingAction).toHaveLength(2);
      for (const button of pendingAction) expect(button).toBeDisabled();

      act(() => pop(10, "/capture"));
      expect(window.location.pathname).toBe("/capture");
      expect(window.history.state.idx).toBe(10);
      expect(screen.getAllByRole("alertdialog", { hidden: true })).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Salir sin guardar" })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: "Seguir capturando" })).not.toBeDisabled();
      expect(subscribe).toHaveBeenCalledTimes(1);

      // A real cancellation after restoration preserves capture. The
      // consumed stale choice must not resurrect another alert afterwards.
      if (choice === "Escape") fireEvent.keyDown(document.body, { key: "Escape" });
      else fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
      expect(screen.queryAllByRole("alertdialog", { hidden: true })).toHaveLength(0);
      expect(current().isCloseBlocked()).toBe(false);
      expect(current().isNavigating).toBe(false);
      expect(screen.getByRole("textbox", { name: "Folio en captura" })).toHaveValue(`${folio} editado`);
      expect(go.mock.calls).toEqual([[-delta], [-delta]]);
      act(() => pop(10, "/capture"));
      expect(screen.queryAllByRole("alertdialog", { hidden: true })).toHaveLength(0);

      // A later confirmed request leaves exactly once from the restored
      // index, without pushState, a duplicate back or a replaced subscription.
      act(() => { pop(10 + delta, "/target"); pop(10, "/capture"); });
      fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));
      expect(go.mock.calls).toEqual([[-delta], [-delta], [-delta], [delta]]);
      act(() => pop(10 + delta, "/target"));
      expect(screen.getByText("Destino de historial")).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "Folio en captura" })).not.toBeInTheDocument();
      expect(screen.queryAllByRole("alertdialog", { hidden: true })).toHaveLength(0);
      expect(oldCloseBlocked()).toBe(false);
      expect(subscribe).toHaveBeenCalledTimes(1);
      expect(push).not.toHaveBeenCalled();
    },
  );
});
