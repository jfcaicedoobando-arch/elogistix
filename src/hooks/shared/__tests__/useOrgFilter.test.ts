/**
 * Tests para `useOrgFilter` — wrapper que expone el `organizationId` activo
 * desde `OrganizationContext` para usar como key/filtro en todas las queries.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useOrgFilter } from "../useOrgFilter";

vi.mock("@/lib/contexts/OrganizationContext", () => ({
  useOrganization: vi.fn(),
}));

import { useOrganization } from "@/lib/contexts/OrganizationContext";

const useOrganizationMock = vi.mocked(useOrganization);

describe("useOrgFilter", () => {
  it("expone organizationId tomado del contexto activo", () => {
    useOrganizationMock.mockReturnValue({ organizationId: "org-123" } as never);
    const { result } = renderHook(() => useOrgFilter());
    expect(result.current.organizationId).toBe("org-123");
  });

  it("propaga null cuando aún no hay organización activa", () => {
    useOrganizationMock.mockReturnValue({ organizationId: null } as never);
    const { result } = renderHook(() => useOrgFilter());
    expect(result.current.organizationId).toBeNull();
  });

  it("propaga undefined sin lanzar", () => {
    useOrganizationMock.mockReturnValue({ organizationId: undefined } as never);
    const { result } = renderHook(() => useOrgFilter());
    expect(result.current.organizationId).toBeUndefined();
  });
});
