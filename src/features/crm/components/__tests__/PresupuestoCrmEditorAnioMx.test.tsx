/**
 * El año inicial del selector debe seguir el calendario de negocio MX:
 * el 31 de diciembre por la noche en CDMX ya es 1 de enero en UTC.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/crm/hooks/useHigienePipeline", () => ({
  usePresupuestoCrm: () => ({ data: [], isLoading: false }),
  useGuardarPresupuestoMes: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/contexts/OrganizationContext", () => ({
  useOrganization: () => ({ organizationId: "org-1" }),
}));

import PresupuestoCrmEditor from "@/features/crm/components/PresupuestoCrmEditor";

describe("PresupuestoCrmEditor · año de negocio MX", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("usa el año MX en la frontera 31 dic / 1 ene", () => {
    // 2027-01-01T05:30Z = 2026-12-31 23:30 en America/Mexico_City.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T05:30:00Z"));

    render(<PresupuestoCrmEditor />);
    expect((screen.getByLabelText("Año") as HTMLInputElement).value).toBe("2026");
  });

  it("conserva el año elegido manualmente", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T05:30:00Z"));

    render(<PresupuestoCrmEditor />);
    const anio = screen.getByLabelText("Año") as HTMLInputElement;
    fireEvent.change(anio, { target: { value: "2030" } });
    expect((screen.getByLabelText("Año") as HTMLInputElement).value).toBe("2030");
  });
});
