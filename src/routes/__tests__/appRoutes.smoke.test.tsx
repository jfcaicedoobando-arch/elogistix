/**
 * Regresión estructural de `appRoutes.tsx` post-poda 13.56.8.
 *
 * Después de introducir el helper `guarded(roles, element)` para colapsar
 * cada ruta protegida a una sola línea, este test garantiza que el
 * comportamiento observable del árbol de rutas no cambió:
 *  - Todas las rutas críticas siguen presentes con su path exacto.
 *  - Cada path protegido conserva los `allowedRoles` esperados.
 *  - Todo el árbol sigue envuelto por `ProtectedRoute` + `Layout`.
 *  - Las redirecciones internas (Navigate replace) siguen activas.
 */
import { describe, it, expect } from "vitest";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { appRoutes } from "../appRoutes";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { Layout } from "@/components/layout/Layout";
import type { AppRole } from "@/types/appRole";

interface RouteProps {
  path?: string;
  element?: ReactNode;
  children?: ReactNode;
}

interface RouteRecord {
  path: string;
  element: ReactElement | null;
}

function collectRoutes(node: ReactNode, acc: RouteRecord[] = []): RouteRecord[] {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const props = (child as ReactElement).props as RouteProps;
    if (typeof props.path === "string") {
      acc.push({
        path: props.path,
        element: isValidElement(props.element) ? props.element : null,
      });
    }
    if (props.children) collectRoutes(props.children, acc);
  });
  return acc;
}

function getRolesFor(records: RouteRecord[], path: string): AppRole[] | null {
  const rec = records.find((r) => r.path === path);
  if (!rec || !rec.element) return null;
  if (rec.element.type !== ProtectedRoute) return null;
  const allowed = (rec.element.props as { allowedRoles?: AppRole[] }).allowedRoles;
  return allowed ?? [];
}

const records = collectRoutes(appRoutes);
const TESORERIA_ROLES: AppRole[] = ["admin", "super_admin", "contador", "tesorero"];

describe("routes/appRoutes — envoltura raíz", () => {
  it("la raíz envuelve Layout con ProtectedRoute (sin allowedRoles → cualquier autenticado)", () => {
    // appRoutes es un único <Route element={<ProtectedRoute><Layout/></ProtectedRoute>}>
    const root = appRoutes as ReactElement;
    expect(isValidElement(root)).toBe(true);
    const wrapper = (root.props as RouteProps).element as ReactElement;
    expect(wrapper.type).toBe(ProtectedRoute);
    const inner = (wrapper.props as { children: ReactElement }).children;
    expect(inner.type).toBe(Layout);
    // sin restricción de roles a nivel raíz
    expect((wrapper.props as { allowedRoles?: AppRole[] }).allowedRoles).toBeUndefined();
  });
});

describe("routes/appRoutes — paths críticos presentes", () => {
  const CRITICAL_PATHS = [
    "/inicio", "/operaciones", "/embarques", "/embarques/nuevo",
    "/embarques/:id", "/embarques/:id/editar",
    "/facturacion", "/facturacion/:id", "/proformas/:id",
    "/cxp", "/cxp/por-capturar", "/cxp/por-pagar", "/compras", "/compras/aging",
    "/facturacion/por-emitir", "/cartera",
    "/tesoreria", "/tesoreria/cuentas", "/tesoreria/conciliacion", "/tesoreria/flujo",
    "/comisiones",
    "/costeo", "/costeo/tarifas", "/costeo/buscar", "/costeo/rutas",
    "/costeo/agentes", "/costeo/navieras", "/costeo/demoras-venta",
    "/profit", "/profit/dashboard", "/profit/proyeccion",
    "/profit/estado-resultados", "/profit/presupuesto",
    "/clientes", "/clientes/:id", "/proveedores", "/proveedores/:id",
    "/cotizaciones", "/cotizaciones/nueva", "/cotizaciones/nueva/tarifario",
    "/cotizaciones/:id", "/cotizaciones/:id/editar",
    "/dev/pdf-preview/cotizacion/:id",
    "/reportes", "/reportes/rentabilidad", "/rentabilidad",
    "/ayuda", "/sentry", "/crm", "/bitacora",
    "/papelera", "/idempotencia", "/auditoria", "/usuarios", "/configuracion",
  ];

  it.each(CRITICAL_PATHS)("expone %s", (path) => {
    expect(records.map((r) => r.path)).toContain(path);
  });

  it("no introduce paths duplicados", () => {
    const paths = records.map((r) => r.path);
    const dups = paths.filter((p, i) => paths.indexOf(p) !== i);
    expect(dups).toEqual([]);
  });
});

describe("routes/appRoutes — gates de rol (post helper guarded())", () => {
  const CASES: Array<[string, AppRole[]]> = [
    ["/cxp", [...TESORERIA_ROLES, "auxiliar_contable"]],
    ["/compras", [...TESORERIA_ROLES, "auxiliar_contable", "admin_org"]],
    ["/compras/aging", [...TESORERIA_ROLES, "auxiliar_contable", "admin_org"]],
    ["/cxp/por-capturar", ["admin", "super_admin", "admin_org", "contador", "auxiliar_contable", "tesorero"]],
    ["/cxp/por-pagar", ["admin", "super_admin", "admin_org", "tesorero"]],
    ["/facturacion/por-emitir", ["admin", "super_admin", "admin_org", "contador"]],
    ["/cartera", ["admin", "super_admin", "admin_org", "contador", "ejecutivo_cobranza"]],
    ["/tesoreria", TESORERIA_ROLES],
    ["/tesoreria/cuentas", TESORERIA_ROLES],
    ["/tesoreria/conciliacion", TESORERIA_ROLES],
    ["/tesoreria/flujo", TESORERIA_ROLES],
    ["/profit/dashboard", TESORERIA_ROLES],
    ["/profit/presupuesto", TESORERIA_ROLES],
    ["/papelera", ["admin", "super_admin"]],
    ["/idempotencia", ["admin", "super_admin"]],
    ["/auditoria", ["admin", "admin_org", "viewer", "customer_service"]],
    ["/usuarios", ["admin", "admin_org", "super_admin"]],
    ["/configuracion", ["admin", "admin_org", "super_admin"]],
  ];

  it.each(CASES)("%s conserva allowedRoles exacto", (path, expected) => {
    const roles = getRolesFor(records, path);
    expect(roles).not.toBeNull();
    expect(roles).toEqual(expected);
  });

  it("ninguna ruta pública (sin gate explícito) usa ProtectedRoute como wrapper interno", () => {
    // Rutas no listadas en CASES no deben envolverse con ProtectedRoute interno
    // (heredan el gate raíz). Esto detecta gates accidentales.
    const guardedPaths = new Set(CASES.map(([p]) => p));
    const accidental = records
      .filter((r) => !guardedPaths.has(r.path))
      .filter((r) => r.element?.type === ProtectedRoute)
      .map((r) => r.path);
    expect(accidental).toEqual([]);
  });
});

describe("routes/appRoutes — redirecciones Navigate", () => {
  it.each([
    ["/costeo", "/costeo/tarifas"],
    ["/profit", "/profit/dashboard"],
    ["/reportes", "/reportes/rentabilidad"],
    ["/rentabilidad", "/reportes/rentabilidad"],
  ])("%s redirige a %s con replace", (from, to) => {
    const rec = records.find((r) => r.path === from);
    expect(rec?.element).toBeTruthy();
    const props = rec!.element!.props as { to?: string; replace?: boolean };
    expect(props.to).toBe(to);
    expect(props.replace).toBe(true);
  });
});
