import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as Dialog from "@radix-ui/react-dialog";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRadixPointerEventsRescue } from "../useRadixPointerEventsRescue";

function RescueDemo() {
  useRadixPointerEventsRescue();
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate("/destination")}>Otra pantalla</button>
      <Dialog.Root>
        <Dialog.Trigger>Abrir diálogo</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Title>Demo de rescate</Dialog.Title>
            <Dialog.Description>Overlay real de Radix sin servicios externos.</Dialog.Description>
            <Dialog.Close>Cerrar diálogo</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function renderDemo() {
  return render(
    <MemoryRouter initialEntries={["/demo"]}>
      <Routes>
        <Route path="/demo" element={<RescueDemo />} />
        <Route path="/destination" element={<p>Destino</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function flushMutations(change: () => void): Promise<void> {
  await act(async () => {
    change();
    await Promise.resolve();
  });
}

// Reproduce only the stranded lock; opening/closing/focus/router are real.
function leaveStrandedLock(): void {
  document.body.style.pointerEvents = "none";
  document.body.setAttribute("data-scroll-locked", "1");
}

describe("Radix rescue internal demo with real Dialog and router", () => {
  beforeEach(() => {
    document.body.removeAttribute("style");
    document.body.removeAttribute("data-scroll-locked");
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.body.removeAttribute("style");
    document.body.removeAttribute("data-scroll-locked");
  });

  it("preserves the modal lock across close/reopen, then rescues after Escape", async () => {
    renderDemo();
    await flushMutations(() => fireEvent.click(screen.getByRole("button", { name: "Abrir diálogo" })));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "open");
    act(() => vi.advanceTimersByTime(100));
    expect(document.body.style.pointerEvents).toBe("none");
    expect(document.body).toHaveAttribute("data-scroll-locked");

    await flushMutations(() => fireEvent.click(screen.getByRole("button", { name: "Cerrar diálogo" })));
    expect(screen.queryByRole("dialog")).toBeNull();
    await flushMutations(leaveStrandedLock);
    act(() => vi.advanceTimersByTime(25));
    await flushMutations(() => fireEvent.click(screen.getByRole("button", { name: "Abrir diálogo" })));
    act(() => vi.advanceTimersByTime(25));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "open");
    expect(document.body.style.pointerEvents).toBe("none");
    expect(document.body).toHaveAttribute("data-scroll-locked");

    await flushMutations(() => fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await flushMutations(leaveStrandedLock);
    act(() => vi.advanceTimersByTime(50));
    expect(document.body.style.pointerEvents).toBe("");
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
  });

  it("cancels a pending rescue when navigation unmounts its owner", async () => {
    renderDemo();
    await flushMutations(leaveStrandedLock);
    await flushMutations(() => fireEvent.click(screen.getByRole("button", { name: "Otra pantalla" })));
    expect(screen.getByText("Destino")).toBeInTheDocument();
    await flushMutations(leaveStrandedLock);
    act(() => vi.advanceTimersByTime(100));
    expect(document.body.style.pointerEvents).toBe("none");
    expect(document.body).toHaveAttribute("data-scroll-locked", "1");
  });
});
