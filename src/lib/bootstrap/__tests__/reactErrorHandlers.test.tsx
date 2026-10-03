import { act, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { reactErrorHandlers } from "../reactErrorHandlers";
const capture = vi.hoisted(() => vi.fn(() => Promise.resolve("mock-event")));
vi.mock("@/lib/observability/captureExceptionOnce", () => ({ captureExceptionOnce: capture }));
afterEach(() => { cleanup(); document.body.innerHTML = ""; });

it("React 19 reports provider render failure through the root callback and renders recovery", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById("root")!, reactErrorHandlers);
  function ProviderCrash(): never { throw new Error("MOCK_PROVIDER_CRASH"); }
  // act() deliberately rethrows uncaught errors instead of exercising React's root callback.
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  try {
    environment.IS_REACT_ACT_ENVIRONMENT = false;
    root.render(<ProviderCrash />);
    await vi.waitFor(() => expect(capture).toHaveBeenCalled());
  } finally {
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
  expect(capture).toHaveBeenCalledWith(expect.objectContaining({ message: "MOCK_PROVIDER_CRASH" }),
    expect.objectContaining({ tags: { source: "react-root-uncaught" } }));
  expect(document.getElementById("root")!.textContent).toMatch(/Recargar/);
  await act(async () => root.unmount());
});
