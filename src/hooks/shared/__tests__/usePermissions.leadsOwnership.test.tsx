/**
 * Test de regresión — v13.823.60
 *
 * Congela el espejo UI de la autorización de leads en la base:
 * gestión total sólo para administración/dirección/gerencia comercial,
 * vendedor únicamente sobre el lead que tiene asignado, y creación de leads
 * limitada a esos mismos roles más `vendedor`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { AppRole } from "@/types/appRole";

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared/usePermissions";

const mockedUseAuth = vi.mocked(useAuth);
const UID = "11111111-1111-4111-8111-111111111111";
const OTRO_UID = "22222222-2222-4222-8222-222222222222";

function setRole(role: AppRole | null, userId: string | null = UID) {
  mockedUseAuth.mockReturnValue({
    role,
    effectiveRole: role,
    user: userId ? { id: userId } : null,
    session: null,
    loading: false,
    signOut: vi.fn(),
    impersonating: null,
    startImpersonation: vi.fn(),
    stopImpersonation: vi.fn(),
    // SAFE-CAST: sólo interesan role/effectiveRole/user para este hook.
  } as unknown as ReturnType<typeof useAuth>);
}

function permisos(role: AppRole | null, userId: string | null = UID) {
  setRole(role, userId);
  return renderHook(() => usePermissions()).result.current;
}

describe("usePermissions — ownership de leads", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each<AppRole>(["admin", "admin_org", "super_admin", "gerente_comercial"])(
    "%s gestiona cualquier lead y en lote",
    (role) => {
      const p = permisos(role);
      expect(p.canGestionarTodosLosLeads).toBe(true);
      expect(p.canGestionarLeadsEnLote).toBe(true);
      expect(p.canGestionarLead(OTRO_UID)).toBe(true);
      expect(p.canGestionarLead(null)).toBe(true);
      expect(p.canCrearLead).toBe(true);
    },
  );

  it("vendedor sólo gestiona su propio lead", () => {
    const p = permisos("vendedor");
    expect(p.canGestionarTodosLosLeads).toBe(false);
    expect(p.canGestionarLeadsEnLote).toBe(false);
    expect(p.canGestionarLead(UID)).toBe(true);
    expect(p.canGestionarLead(OTRO_UID)).toBe(false);
    expect(p.canGestionarLead(null)).toBe(false);
    expect(p.canCrearLead).toBe(true);
  });

  it("sin sesión resuelta, el vendedor no gestiona nada", () => {
    const p = permisos("vendedor", null);
    expect(p.canGestionarLead(UID)).toBe(false);
  });

  it.each<AppRole>(["operador", "coordinador_logistico", "contador", "viewer", "customer_service"])(
    "%s no gestiona ni crea leads",
    (role) => {
      const p = permisos(role);
      expect(p.canGestionarTodosLosLeads).toBe(false);
      expect(p.canGestionarLead(UID)).toBe(false);
      expect(p.canCrearLead).toBe(false);
      expect(p.canGestionarLeadsEnLote).toBe(false);
    },
  );

  it("sin rol no hay capacidades de leads", () => {
    const p = permisos(null);
    expect(p.canGestionarTodosLosLeads).toBe(false);
    expect(p.canCrearLead).toBe(false);
    expect(p.canGestionarLead(UID)).toBe(false);
  });
});
