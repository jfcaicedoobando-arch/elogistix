/**
 * Regresión — actividades legadas asignadas sólo por correo.
 *
 * Espeja `filtroResponsable`: el correo decide la propiedad únicamente cuando
 * `responsable_id` es nulo. Así el dueño ve "Marcar completada" en las mismas
 * actividades que aparecen en "Mis actividades".
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

describe("canGestionarActividad — responsable por correo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permite gestionar cuando el id coincide (aunque el correo sea de otro)", () => {
    expect(permisosVendedor().canGestionarActividad(UID, "otro@librecarga.com")).toBe(true);
  });

  it("permite gestionar cuando sólo hay correo y coincide", () => {
    expect(permisosVendedor().canGestionarActividad(null, EMAIL.toUpperCase())).toBe(true);
  });

  it("no permite gestionar la actividad de otro usuario", () => {
    const p = permisosVendedor();
    expect(p.canGestionarActividad(OTRO_UID)).toBe(false);
    expect(p.canGestionarActividad(null, "otro@librecarga.com")).toBe(false);
    expect(p.canGestionarActividad(null, null)).toBe(false);
  });
});
