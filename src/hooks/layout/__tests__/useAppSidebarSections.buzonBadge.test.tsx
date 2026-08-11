/**
 * v13.502.0 — El sidebar muestra un badge con los documentos del buzón CxP
 * pendientes por capturar (antes contabilidad tenía que entrar a la bandeja).
 */
import { vi, describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/features/auditoria/hooks", () => ({ useAuditoriaCount: () => ({ data: 0 }) }));
vi.mock("@/features/admin/hooks", () => ({ useAlertasPendingCount: () => ({ count: 0 }) }));
vi.mock("@/features/crm/hooks/useCrmDashboard", () => ({
  useActividadesVencidasCount: () => ({ data: 0 }),
}));
vi.mock("../useSidebarAlerts", () => ({
  useSidebarAlerts: () => ({
    totalAlertas: 0,
    embarquesDemora: 0,
    facturasVencidas: 0,
    garantiasAtoradas: 0,
    adminPendientes: 0,
  }),
}));
vi.mock("@/features/cxp/hooks/useCxpPendientesAprobacion", () => ({
  useCxpPendientesAprobacion: () => ({ data: 0 }),
}));
vi.mock("@/features/cxp/hooks/useCxpPorPagarCount", () => ({
  useCxpPorPagarCount: () => ({ data: 0 }),
}));
const porCapturar = { valor: 7 };
vi.mock("@/features/cxp/hooks/useEntrantesPorCapturarCount", () => ({
  useEntrantesPorCapturarCount: () => ({ data: porCapturar.valor }),
}));

import { useAuth } from "@/lib/contexts/AuthContext";
import { useAppSidebarSections } from "../useAppSidebarSections";

function itemBuzon() {
  const { result } = renderHook(() => useAppSidebarSections());
  return result.current
    .flatMap((s) => s.items)
    .find((it) => it.url === "/compras/buzon");
}

describe("badge del buzón de facturas en el sidebar", () => {
  it("pinta el conteo de documentos por capturar", () => {
    porCapturar.valor = 7;
    // SAFE-CAST: mock de contexto en prueba unitaria.
    (useAuth as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      role: "admin", effectiveRole: "admin_org",
    });
    const item = itemBuzon();
    expect(item?.badgeCount).toBe(7);
    expect(item?.badgeHint).toContain("7 documento(s) por capturar");
  });

  it("no pinta badge cuando el buzón está vacío", () => {
    porCapturar.valor = 0;
    // SAFE-CAST: mock de contexto en prueba unitaria.
    (useAuth as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      role: "admin", effectiveRole: "admin_org",
    });
    expect(itemBuzon()?.badgeCount).toBeUndefined();
  });
});
