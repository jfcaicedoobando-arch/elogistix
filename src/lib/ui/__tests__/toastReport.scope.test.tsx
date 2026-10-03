// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorDetailsDialog } from "@/components/ui/ErrorDetailsDialog";
import { clearErrorReports } from "@/lib/diagnostics/errorDetailsStore";
import { subscribeErrorReportScope } from "@/lib/diagnostics/errorReportScope";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { notifyError, notifyWarning } from "../appFeedback";

const mocks = vi.hoisted(() => ({
  error: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), dismiss: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: mocks }));
vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: vi.fn() }));
const initial = { userId: "mock-a", email: null, organizationId: "org-a",
  organizationName: null, role: "contador", effectiveRole: "contador" };
beforeEach(() => { clearErrorReports(); setAuthSnapshot(initial); vi.clearAllMocks(); });
afterEach(() => { cleanup(); clearErrorReports(); });

describe("Toast actions stay inside their session scope", () => {
  it.each(["userId", "organizationId", "effectiveRole"] as const)(
    "invalidates details and retry when %s changes", (field) => {
      const retry = vi.fn();
      render(<ErrorDetailsDialog />);
      act(() => notifyWarning(undefined, { title: "MOCK operación parcial",
        error: new Error("MOCK"), action: { label: "Reintentar", onClick: retry } }));
      const controls = mocks.warning.mock.calls.at(-1)?.[1];
      act(() => controls.cancel.onClick());
      expect(screen.getByRole("dialog")).toBeVisible();
      act(() => setAuthSnapshot({ ...initial, [field]: "mock-nuevo" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      act(() => { controls.cancel.onClick(); controls.action.onClick(); controls.onAutoClose(); });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Ver último error" })).not.toBeInTheDocument();
      expect(retry).not.toHaveBeenCalled();
      act(() => notifyWarning(undefined, { title: "MOCK nueva sesión" }));
      act(() => mocks.warning.mock.calls.at(-1)?.[1].action.onClick());
      expect(screen.getByRole("dialog")).toBeVisible();
    },
  );
  it("keeps current error retry working, but invalidates the captured action on logout", () => {
    const retry = vi.fn();
    notifyError(undefined, { title: "MOCK", action: { label: "Reintentar", onClick: retry } });
    const controls = mocks.error.mock.calls.at(-1)?.[1];
    controls.action.onClick();
    expect(retry).toHaveBeenCalledTimes(1);
    setAuthSnapshot({ ...initial, userId: null, organizationId: null, effectiveRole: null });
    controls.action.onClick();
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it("notifies the mounted toaster to dismiss notifications and supports unsubscribe", () => {
    const dismiss = vi.fn();
    const unsubscribe = subscribeErrorReportScope(dismiss);
    setAuthSnapshot({ ...initial, effectiveRole: "agente" });
    expect(dismiss).toHaveBeenCalledTimes(1);
    unsubscribe();
    setAuthSnapshot(initial);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
