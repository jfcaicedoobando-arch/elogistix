/**
 * Tests para la tarjeta de información de organización en /configuracion.
 * Cubre render con datos, badge de inactiva, y acción de copiar ID.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const useOrgMock = vi.fn();
const writeTextMock = vi.fn();
const sonnerSuccessMock = vi.fn();
const sonnerErrorMock = vi.fn();

vi.mock("@/lib/contexts/OrganizationContext", () => ({
  useOrganization: () => useOrgMock(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign((...a: unknown[]) => sonnerSuccessMock(...a), {
    success: (...a: unknown[]) => sonnerSuccessMock(...a),
    error: (...a: unknown[]) => sonnerErrorMock(...a),
    warning: (...a: unknown[]) => sonnerErrorMock(...a),
  }),
}));

vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: vi.fn() }));
vi.mock("@/lib/diagnostics/errorDetailsStore", () => ({ openErrorReport: vi.fn() }));

import { OrgInfoCard } from "../OrgInfoCard";

describe("OrgInfoCard (configuracion)", () => {
  beforeEach(() => {
    useOrgMock.mockReset();
    writeTextMock.mockReset();
    sonnerSuccessMock.mockReset();
    sonnerErrorMock.mockReset();
    // v13.137.25: `vi.stubGlobal` se restaura via `vi.unstubAllGlobals()` del
    // afterEach global. Antes mutábamos `navigator.clipboard` directo, que
    // quedaba persistente entre archivos en singleFork.
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: (t: string) => { writeTextMock(t); return Promise.resolve(); } },
    });
  });

  it("no renderiza nada si no hay organización", () => {
    useOrgMock.mockReturnValue({ organization: null });
    const { container } = render(<OrgInfoCard />);
    expect(container.firstChild).toBeNull();
  });

  it("muestra nombre, plan e ID de la organización", () => {
    useOrgMock.mockReturnValue({
      organization: { id: "org-abc-123", nombre: "ACME Logística", plan: "PRO", activo: true },
    });
    render(<OrgInfoCard />);
    expect(screen.getByText("ACME Logística")).toBeInTheDocument();
    expect(screen.getByText("PRO")).toBeInTheDocument();
    expect(screen.getByText("org-abc-123")).toBeInTheDocument();
    expect(screen.queryByText(/inactiva/i)).not.toBeInTheDocument();
  });

  it("muestra badge Inactiva cuando activo=false", () => {
    useOrgMock.mockReturnValue({
      organization: { id: "x", nombre: "X", plan: "", activo: false },
    });
    render(<OrgInfoCard />);
    expect(screen.getByText(/inactiva/i)).toBeInTheDocument();
    // plan fallback "—"
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("copia el ID al clipboard y notifica éxito", async () => {
    useOrgMock.mockReturnValue({
      organization: { id: "uuid-99", nombre: "X", plan: "PRO", activo: true },
    });
    render(<OrgInfoCard />);
    fireEvent.click(screen.getByLabelText(/copiar id/i));
    await waitFor(() => expect(writeTextMock).toHaveBeenCalledWith("uuid-99"));
    expect(sonnerSuccessMock).toHaveBeenCalled();
  });
});
