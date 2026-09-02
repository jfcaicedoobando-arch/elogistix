import { describe, it, expect } from "vitest";
import { ROLE_BUILDERS } from "@/hooks/layout/sidebarRoleBuilders";
import { hasRouteAccess } from "@/lib/access/roleRouteMatrix";
import { SIDEBAR_CRM_ITEMS, SIDEBAR_SISTEMA_ITEMS } from "@/components/layout/sidebarItems";

/**
 * ALCANCE A — gerente_operaciones gana descubribilidad de Costeo (sidebar +
 * acceso a la ruta). Ningún otro rol gana acceso por este cambio.
 */
const deps = { crmItems: SIDEBAR_CRM_ITEMS, sistemaItems: SIDEBAR_SISTEMA_ITEMS };

describe("gerente_operaciones ve y puede abrir Costeo", () => {
  it("el sidebar de gerente_operaciones incluye la sección Costeo", () => {
    const sections = ROLE_BUILDERS.gerente_operaciones(deps);
    const costeo = sections.find((s) => s.label === "Costeo");
    expect(costeo).toBeDefined();
    expect(costeo?.items.some((it) => it.url === "/costeo/tarifas")).toBe(true);
  });

  it("hasRouteAccess permite a gerente_operaciones abrir /costeo/tarifas, /costeo/agentes y /costeo/navieras", () => {
    expect(hasRouteAccess("gerente_operaciones", "/costeo/tarifas")).toBe(true);
    expect(hasRouteAccess("gerente_operaciones", "/costeo/agentes")).toBe(true);
    expect(hasRouteAccess("gerente_operaciones", "/costeo/navieras")).toBe(true);
  });
});

describe("otros roles no ganan acceso a Costeo por este cambio", () => {
  it("viewer sigue sin acceso a Costeo", () => {
    expect(hasRouteAccess("viewer", "/costeo/tarifas")).toBe(false);
  });

  it("cliente sigue sin acceso a Costeo", () => {
    expect(hasRouteAccess("cliente", "/costeo/tarifas")).toBe(false);
  });

  it("operador conserva su acceso previo (no cambia)", () => {
    expect(hasRouteAccess("operador", "/costeo/tarifas")).toBe(true);
  });
});

describe("el agente_carga conserva su portal", () => {
  it("no tiene acceso a rutas internas de Costeo", () => {
    expect(hasRouteAccess("agente_carga", "/costeo/tarifas")).toBe(false);
  });
});
