/**
 * v13.823.348 — `canWriteCotizaciones` es la capacidad específica de ESCRITURA
 * de cotizaciones (espejo de `puede_escribir_cotizaciones()` /
 * `_assert_writer_cotizacion`). El `canEdit` amplio incluye finanzas, que sólo
 * puede LEER: con él, contabilidad/tesorería veían "Nueva cotización",
 * duplicar, eliminar y "Editar costos" y las RPC respondían 42501.
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePermissions } from "@/hooks/shared";

vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: vi.fn() }));

import { useAuth } from "@/lib/contexts/AuthContext";
const mockUseAuth = vi.mocked(useAuth);

type Auth = ReturnType<typeof useAuth>;

function conRol(rol: string) {
  mockUseAuth.mockReturnValue({ role: rol, effectiveRole: rol } as Partial<Auth> as Auth);
  return renderHook(() => usePermissions()).result;
}

describe("canWriteCotizaciones", () => {
  it.each(["vendedor", "customer_service", "admin"])("%s puede escribir cotizaciones", (rol) => {
    expect(conRol(rol).current.canWriteCotizaciones).toBe(true);
  });

  it.each(["contador", "auxiliar_contable", "tesorero", "viewer"])(
    "%s NO puede escribir cotizaciones",
    (rol) => {
      expect(conRol(rol).current.canWriteCotizaciones).toBe(false);
    },
  );

  it("contador conserva canEdit (lectura financiera) sin escritura de cotizaciones", () => {
    const r = conRol("contador");
    expect(r.current.canEdit).toBe(true);
    expect(r.current.canWriteCotizaciones).toBe(false);
  });
});
