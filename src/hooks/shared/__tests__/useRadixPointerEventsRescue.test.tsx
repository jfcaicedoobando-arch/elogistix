import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRadixPointerEventsRescue } from "../useRadixPointerEventsRescue";

async function mutateBody(change: () => void): Promise<void> {
  await act(async () => {
    change();
    await Promise.resolve();
  });
}

function lockBody(): void {
  document.body.style.pointerEvents = "none";
  document.body.setAttribute("data-scroll-locked", "1");
}

function expectLocked(): void {
  expect(document.body.style.pointerEvents).toBe("none");
  expect(document.body).toHaveAttribute("data-scroll-locked", "1");
}

function expectUnlocked(): void {
  expect(document.body.style.pointerEvents).toBe("");
  expect(document.body).not.toHaveAttribute("data-scroll-locked");
}

describe("useRadixPointerEventsRescue lifecycle", () => {
  beforeEach(() => {
    document.body.removeAttribute("style");
    document.body.removeAttribute("data-scroll-locked");
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.removeAttribute("style");
    document.body.removeAttribute("data-scroll-locked");
  });

  it("rescues a stranded lock after 50 ms and preserves unrelated styles", async () => {
    renderHook(useRadixPointerEventsRescue);
    await mutateBody(() => {
      document.body.style.color = "red";
      lockBody();
    });
    act(() => vi.advanceTimersByTime(49));
    expectLocked();
    act(() => vi.advanceTimersByTime(1));
    expectUnlocked();
    expect(document.body.style.color).toBe("red");
  });

  it("deduplicates repeated body mutations without postponing the rescue", async () => {
    renderHook(useRadixPointerEventsRescue);
    await mutateBody(lockBody);
    act(() => vi.advanceTimersByTime(25));
    await mutateBody(() => document.body.style.setProperty("color", "blue"));
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(25));
    expectUnlocked();
  });

  it("does not schedule a rescue when the body is unlocked", async () => {
    renderHook(useRadixPointerEventsRescue);
    await mutateBody(() => document.body.style.setProperty("pointer-events", "auto"));
    expect(vi.getTimerCount()).toBe(0);
    expect(document.body.style.pointerEvents).toBe("auto");
  });

  it.each(["dialog", "alertdialog", "menu", "listbox"])(
    "keeps a legitimate open %s locked",
    async (role) => {
      renderHook(useRadixPointerEventsRescue);
      const overlay = document.createElement("div");
      overlay.setAttribute("role", role);
      overlay.setAttribute("data-state", "open");
      document.body.append(overlay);
      await mutateBody(lockBody);
      expect(vi.getTimerCount()).toBe(0);
      act(() => vi.advanceTimersByTime(100));
      expectLocked();
    },
  );

  it("keeps an open Radix popper locked even without an overlay role", async () => {
    renderHook(useRadixPointerEventsRescue);
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-radix-popper-content-wrapper", "");
    wrapper.innerHTML = '<div data-state="open"></div>';
    document.body.append(wrapper);
    await mutateBody(lockBody);
    act(() => vi.advanceTimersByTime(100));
    expectLocked();
  });

  it("rechecks an overlay opened while the rescue is pending", async () => {
    renderHook(useRadixPointerEventsRescue);
    await mutateBody(lockBody);
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("data-state", "open");
    document.body.append(overlay);
    act(() => vi.advanceTimersByTime(50));
    expectLocked();
    overlay.remove();
    await mutateBody(() => document.body.setAttribute("data-scroll-locked", "1"));
    act(() => vi.advanceTimersByTime(50));
    expectUnlocked();
  });

  it("cancels the pending rescue on unmount and stops observing", async () => {
    const { unmount } = renderHook(useRadixPointerEventsRescue);
    await mutateBody(lockBody);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await mutateBody(() => document.body.style.setProperty("color", "green"));
    act(() => vi.advanceTimersByTime(100));
    expectLocked();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores an already queued callback after unmount", async () => {
    const timeout = vi.spyOn(globalThis, "setTimeout");
    const { unmount } = renderHook(useRadixPointerEventsRescue);
    await mutateBody(lockBody);
    const callback = timeout.mock.calls.find(([, delay]) => delay === 50)?.[0];
    expect(callback).toBeTypeOf("function");
    unmount();
    // Simulate a callback already handed to the event queue before cancellation.
    if (typeof callback !== "function") throw new Error("Missing rescue callback");
    act(() => callback());
    expectLocked();
  });
});
