// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { registerDirtyHistoryGuard, subscribeDirtyHistoryGuard } from "../dirtyHistoryGuard";

registerDirtyHistoryGuard();

describe("Guardia de historial instalada antes del router", () => {
  it("deja navegar cuando ningún formulario activó la guardia", () => {
    const router = vi.fn();
    window.addEventListener("popstate", router);
    window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: 0 } }));
    expect(router).toHaveBeenCalledOnce();
    window.removeEventListener("popstate", router);
  });

  it("intercepta antes del listener posterior y libera la navegación al desmontar", () => {
    const router = vi.fn();
    window.addEventListener("popstate", router);
    const guard = vi.fn((event: PopStateEvent) => event.stopImmediatePropagation());
    const unsubscribe = subscribeDirtyHistoryGuard(guard);
    window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: 0 } }));
    expect(guard).toHaveBeenCalledOnce();
    expect(router).not.toHaveBeenCalled();
    unsubscribe();
    window.dispatchEvent(new PopStateEvent("popstate", { state: { idx: 0 } }));
    expect(router).toHaveBeenCalledOnce();
    window.removeEventListener("popstate", router);
  });
});
