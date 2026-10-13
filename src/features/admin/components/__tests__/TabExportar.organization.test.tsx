import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ organization: vi.fn(), download: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: h.organization }));
vi.mock("@/features/admin/services", () => ({ exportOrganizationZip: h.download, EXPORT_TABLES: [], EXPORT_GROUPS: {} }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: h.error }));
import TabExportar from "../TabExportar";

beforeEach(() => { h.download.mockResolvedValue(undefined); });

describe("TabExportar: organización solicitada", () => {
  it.each([
    { organizationId: null, organization: null },
    { organizationId: "org-a", organization: null },
  ])("no invoca exportación sin contexto completo: %j", async (context) => {
    h.organization.mockReturnValue(context);
    render(<TabExportar />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar ZIP" }));
    expect(h.download).not.toHaveBeenCalled();
    expect(h.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: "No hay organización activa" }));
  });

  it("envía el ID y nombre activos al servicio, sin adoptar el perfil global", async () => {
    h.organization.mockReturnValue({ organizationId: "org-a", organization: { id: "org-a", nombre: "Comercial A" } });
    render(<TabExportar />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar ZIP" }));
    await waitFor(() => expect(h.download).toHaveBeenCalledWith("org-a", "Comercial A", expect.any(Function)));
    expect(h.error).not.toHaveBeenCalled();
  });
});
