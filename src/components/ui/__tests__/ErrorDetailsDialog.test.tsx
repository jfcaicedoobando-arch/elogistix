// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorDetailsDialog } from "../ErrorDetailsDialog";
import { buildErrorReport } from "@/lib/ui/errorReport";
import { clearErrorReports, openErrorReport, rememberErrorReport, offerErrorRecovery } from "@/lib/diagnostics/errorDetailsStore";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";

beforeEach(() => { clearErrorReports(); });
afterEach(() => { cleanup(); clearErrorReports(); vi.restoreAllMocks(); });
const report = () => buildErrorReport({ title: "Costo no guardado", requestId: "backend-123", error: new Error("MOCK") });
function open() { const next = report(); rememberErrorReport(next); openErrorReport(next); render(<ErrorDetailsDialog />); }

describe("ErrorDetailsDialog", () => {
  it("copies valid JSON with backend ID and reports success inside the dialog", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Copiar JSON" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON copiado"));
    expect(JSON.parse(writeText.mock.calls[0][0]).requestId).toBe("backend-123");
  });
  it("keeps original JSON selectable with clipboard failure details and inline fallback", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("MOCK denied")) } });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Copiar JSON" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("cópialo manualmente"));
    const field = screen.getByRole("textbox", { name: "JSON del error" }) as HTMLTextAreaElement;
    const json = JSON.parse(field.value);
    expect(json.requestId).toBe("backend-123");
    expect(json.clipboardError.message).toBe("MOCK denied");
    fireEvent.focus(field);
    expect(field.selectionEnd - field.selectionStart).toBe(field.value.length);
  });
  it("offers latest report after expiry and clears it when session scope changes", () => {
    render(<ErrorDetailsDialog />);
    const next = report();
    act(() => { rememberErrorReport(next); offerErrorRecovery(next); });
    fireEvent.click(screen.getByRole("button", { name: "Ver último error" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    act(() => setAuthSnapshot({ userId: "nuevo", email: null, organizationId: "otra", organizationName: null, role: null, effectiveRole: null }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver último error" })).not.toBeInTheDocument();
  });
});
