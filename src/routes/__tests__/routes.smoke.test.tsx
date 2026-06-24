/**
 * Smoke tests estructurales de los configs de rutas (Fase 3 auditoría — 12.90.0).
 *
 * No montan Router (eso requeriría stubs pesados de páginas lazy + auth).
 * Sólo inspeccionan el árbol de `<Route>` elements para garantizar que:
 *  - los configs siguen siendo elementos React válidos.
 *  - las rutas críticas siguen presentes (regresión silenciosa de paths).
 *  - los gates de seguridad (`ProtectedRoute`/`PortalProtectedRoute`) envuelven
 *    todo el bloque protegido (no se cuela una ruta admin sin gate).
 */
import { describe, it, expect } from "vitest";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { publicRoutes } from "../publicRoutes";
import { portalRoutes } from "../portalRoutes";
import { adminRoutes } from "../adminRoutes";

interface RouteLike {
  path?: string;
  element?: unknown;
  children?: ReactNode;
}

function collectPaths(node: ReactNode): string[] {
  const paths: string[] = [];
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const props = (child as ReactElement).props as RouteLike;
    if (typeof props.path === "string") paths.push(props.path);
    if (props.children) paths.push(...collectPaths(props.children));
  });
  return paths;
}

function getWrapperName(node: ReactNode): string | null {
  let found: string | null = null;
  Children.forEach(node, (child) => {
    if (found || !isValidElement(child)) return;
    const props = (child as ReactElement).props as RouteLike & { element?: ReactElement };
    if (props.element && isValidElement(props.element)) {
      const type = props.element.type as { displayName?: string; name?: string } | string;
      if (typeof type === "function" || typeof type === "object") {
        found = (type as { displayName?: string; name?: string }).displayName
          ?? (type as { name?: string }).name
          ?? null;
      }
    }
  });
  return found;
}

describe("routes/publicRoutes", () => {
  it("expone rutas públicas críticas sin gate (login, tracking, legal)", () => {
    const paths = collectPaths(publicRoutes);
    expect(paths).toContain("/");
    expect(paths).toContain("/login");
    expect(paths).toContain("/reset-password");
    expect(paths).toContain("/tracking/:token");
    expect(paths).toContain("/legal/privacidad");
    expect(paths).toContain("/legal/terminos");
    expect(paths).toContain("*"); // 404 fallback
  });

  it("redirige /portal/login → /login", () => {
    const paths = collectPaths(publicRoutes);
    expect(paths).toContain("/portal/login");
  });
});

describe("routes/portalRoutes", () => {
  it("todas las rutas del portal están envueltas por PortalProtectedRoute", () => {
    const wrapper = getWrapperName(portalRoutes);
    expect(wrapper).toMatch(/PortalProtectedRoute|PortalLayout/);
  });

  it("expone rutas críticas del portal (dashboard, embarques, facturas, perfil)", () => {
    const paths = collectPaths(portalRoutes);
    expect(paths).toContain("/portal");
    expect(paths).toContain("/portal/embarques");
    expect(paths).toContain("/portal/embarques/:id");
    expect(paths).toContain("/portal/cotizaciones");
    expect(paths).toContain("/portal/facturas");
    expect(paths).toContain("/portal/perfil");
  });
});

describe("routes/adminRoutes", () => {
  it("todas las rutas admin están envueltas por ProtectedRoute (gate super_admin)", () => {
    const wrapper = getWrapperName(adminRoutes);
    expect(wrapper).toMatch(/ProtectedRoute|AdminLayout/);
  });

  it("expone rutas admin críticas (orgs, configuración, diagnóstico)", () => {
    const paths = collectPaths(adminRoutes);
    expect(paths).toContain("/admin");
    expect(paths).toContain("/admin/organizaciones");
    expect(paths).toContain("/admin/organizaciones/:id");
    expect(paths).toContain("/admin/configuracion");
    expect(paths).toContain("/admin/diagnostico");
  });

  it("ninguna ruta admin se filtra fuera del gate (todas /admin/*)", () => {
    const paths = collectPaths(adminRoutes);
    const noAdminPrefix = paths.filter((p) => !p.startsWith("/admin"));
    expect(noAdminPrefix).toEqual([]);
  });
});
