/**
 * Test de regresión — v13.300.10
 *
 * Bloquea la divergencia entre el frontend (`RESPONDER_PROFORMA_MANUAL` en
 * `usePermissions.ts`) y el RPC de DB `actualizar_estado_cliente_proforma`.
 *
 * Política v13.145.8: sólo admins de tenant y gerentes pueden aceptar/rechazar
 * una proforma manualmente cuando el cliente confirma por otro canal
 * (WhatsApp, llamada, email).
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

function setRole(role: AppRole | null) {
  mockedUseAuth.mockReturnValue({
    role,
    effectiveRole: role,
    // Campos restantes del contexto — no los usa este hook.
    user: null,
    session: null,
    loading: false,
    signOut: vi.fn(),
    impersonating: null,
    startImpersonation: vi.fn(),
    stopImpersonation: vi.fn(),
    // SAFE-CAST: sólo interesan role/effectiveRole para este test.
  } as unknown as ReturnType<typeof useAuth>);
}

describe("usePermissions.canResponderProformaManual", () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  const permitidos: AppRole[] = [
    "super_admin",
    "admin_org",
    "admin",
    "gerente_operaciones",
    "gerente_comercial",
  ];

  const noPermitidos: AppRole[] = [
    "contador",
    "operador",
    "coordinador_logistico",
    "ejecutivo_pricing",
    "vendedor",
    "tesorero",
    "viewer",
    "customer_service",
  ];

  it.each(permitidos)("permite responder manualmente al rol %s", (role) => {
    setRole(role);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canResponderProformaManual).toBe(true);
  });

  it.each(noPermitidos)("NO permite responder manualmente al rol %s", (role) => {
    setRole(role);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canResponderProformaManual).toBe(false);
  });

  it("bloquea cuando no hay rol (usuario sin sesión)", () => {
    setRole(null);
    const { result } = renderHook(() => usePermissions());
    expect(result.current.canResponderProformaManual).toBe(false);
  });
});
