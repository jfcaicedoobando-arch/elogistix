/**
 * A2 — fuente única de organización activa.
 *
 * `useAuth().organizationId` es NULL para el super admin de plataforma; usarlo
 * en rutas de escritura produce registros huérfanos o "organización no
 * resuelta" aunque el OrgSwitcher tenga un tenant activo. Este test congela el
 * contrato: `useOrgActiva` siempre devuelve la organización del
 * `OrganizationContext`.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const orgCtx = { organizationId: null as string | null };
vi.mock("@/lib/contexts/OrganizationContext", () => ({
  useOrganization: () => orgCtx,
}));

const { useOrgActiva } = await import("../useOrgActiva");

describe("useOrgActiva", () => {
  it("devuelve la organización del usuario normal", () => {
    orgCtx.organizationId = "org-a";
    const { result } = renderHook(() => useOrgActiva());
    expect(result.current.organizationId).toBe("org-a");
  });

  it("para el super admin devuelve el tenant elegido en el OrgSwitcher", () => {
    orgCtx.organizationId = "org-b";
    const { result } = renderHook(() => useOrgActiva());
    expect(result.current.organizationId).toBe("org-b");
  });

  it("devuelve null cuando no hay tenant activo (fail-closed)", () => {
    orgCtx.organizationId = null;
    const { result } = renderHook(() => useOrgActiva());
    expect(result.current.organizationId).toBeNull();
  });
});
