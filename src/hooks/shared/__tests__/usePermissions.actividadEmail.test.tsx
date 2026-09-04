/**
 * Regresión — acciones de actividades (completar/posponer) espejan la policy
 * `Vendedor own crm_actividades`, que sólo permite UPDATE con
 * `responsable_id = auth.uid()`.
 *
 * Una actividad legada asignada sólo por `responsable_email` puede aparecer en
 * "Mis actividades" (filtro), pero NO debe habilitar la mutación: el UPDATE
 * sería rechazado por RLS.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: vi.fn() }));

import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared/usePermissions";

const mockedUseAuth = vi.mocked(useAuth);
const UID = "11111111-1111-4111-8111-111111111111";
const OTRO_UID = "22222222-2222-4222-8222-222222222222";
const EMAIL = "kam@librecarga.com";

function permisosVendedor() {
  mockedUseAuth.mockReturnValue({
    role: "vendedor",
    effectiveRole: "vendedor",
    user: { id: UID, email: EMAIL },
    session: null,
    loading: false,
    signOut: vi.fn(),
    impersonating: null,
    startImpersonation: vi.fn(),
    stopImpersonation: vi.fn(),
    // SAFE-CAST: sólo interesan role/effectiveRole/user.
  } as unknown as ReturnType<typeof useAuth>);
  return renderHook(() => usePermissions()).result.current;
}

describe("canGestionarActividad — espejo de RLS", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permite gestionar la actividad propia por responsable_id", () => {
    expect(permisosVendedor().canGestionarActividad(UID)).toBe(true);
  });

  it("NO habilita mutación cuando la actividad sólo tiene responsable_email propio", () => {
    // El correo coincide con la sesión, pero la policy exige responsable_id.
    expect(permisosVendedor().canGestionarActividad(null)).toBe(false);
  });

  it("no permite gestionar la actividad de otro usuario", () => {
    expect(permisosVendedor().canGestionarActividad(OTRO_UID)).toBe(false);
  });
});
