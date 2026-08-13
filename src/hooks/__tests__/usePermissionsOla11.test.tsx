/**
 * Sprint 05 (Ola 11) — Capacidades nuevas/gateadas: adjuntar XML al buzón CxP
 * (RNF-08) y los gates de cobro/pago en lote (RFE-04). Archivo aparte para no
 * pasar de 200 líneas en `usePermissions.test.tsx` (Power of 10 #4).
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

describe("RNF-08 · canAdjuntarXmlFacturaEntrante", () => {
  it.each(["operador", "coordinador_logistico", "contador", "auxiliar_contable", "admin"])(
    "%s puede adjuntar el XML faltante",
    (rol) => {
      expect(conRol(rol).current.canAdjuntarXmlFacturaEntrante).toBe(true);
    },
  );

  it.each(["gerente_visor", "viewer", "vendedor"])("%s NO puede adjuntar XML", (rol) => {
    expect(conRol(rol).current.canAdjuntarXmlFacturaEntrante).toBe(false);
  });
});

describe("RFE-04 · gates de cobro y pago en lote", () => {
  it.each(["gerente_visor", "gerente_comercial", "gerente_operaciones", "viewer"])(
    "%s no ve cobro ni pago en lote (la RPC lo rechazaría con 42501)",
    (rol) => {
      const r = conRol(rol);
      expect(r.current.canRegistrarCobro).toBe(false);
      expect(r.current.canPagarProveedor).toBe(false);
    },
  );

  // Segregación de funciones (Q-04): contabilidad cobra; el tesorero paga.
  it.each(["contador", "ejecutivo_cobranza", "admin"])("%s sí puede cobrar en lote", (rol) => {
    expect(conRol(rol).current.canRegistrarCobro).toBe(true);
  });

  it.each(["tesorero", "admin"])("%s sí puede pagar en lote", (rol) => {
    expect(conRol(rol).current.canPagarProveedor).toBe(true);
  });

  it("contador NO paga en lote (SoD: sólo tesorería dispersa)", () => {
    expect(conRol("contador").current.canPagarProveedor).toBe(false);
  });
});
