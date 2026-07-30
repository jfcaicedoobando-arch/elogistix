/**
 * Regresión estructural de `appRoutes.tsx`.
 *
 * v13.175.0 — Rediseño Compras (Ola A): el módulo se unifica bajo `/compras/*`
 * y las rutas legacy (`/cxp`, `/cxp/por-*`, `/proveedores`) redirigen preservando
 * querystring vía `<RedirectPreserveSearch />`.
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
import { RedirectPreserveSearch } from "@/routes/RedirectPreserveSearch";
import { Layout } from "@/components/layout/Layout";
import type { AppRole } from "@/types/appRole";
import {
  COMPRAS_READ_ROLES,
  FINANCE_READ_ROLES,
  TESORERIA_READ_ROLES,
  PROFIT_READ_ROLES,
  AUDITORIA_ROLES,
} from "@/lib/access/roleRouteMatrix";

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
// v13.343.1 — Fuente única: se importan los sets reales de la matriz en vez de
// duplicarlos aquí (el duplicado se desincronizó en el orden de los roles).

describe("routes/appRoutes — envoltura raíz", () => {
  it("la raíz envuelve Layout con ProtectedRoute", () => {
    const root = appRoutes as ReactElement;
    expect(isValidElement(root)).toBe(true);
    const wrapper = (root.props as RouteProps).element as ReactElement;
    expect(wrapper.type).toBe(ProtectedRoute);
    const inner = (wrapper.props as { children: ReactElement }).children;
    expect(inner.type).toBe(Layout);
    expect((wrapper.props as { allowedRoles?: AppRole[] }).allowedRoles).toBeUndefined();
  });
});

describe("routes/appRoutes — paths críticos presentes", () => {
  const CRITICAL_PATHS = [
    "/inicio", "/operaciones", "/embarques", "/embarques/nuevo",
    "/embarques/:id", "/embarques/:id/editar",
    "/facturacion", "/facturacion/:id", "/proformas/:id",
    // Módulo Compras unificado (v13.175.0)
    "/compras", "/compras/por-capturar", "/compras/por-aprobar", "/compras/por-pagar",
    "/compras/facturas", "/compras/pagos", "/compras/notas-credito",
    "/compras/proveedores", "/compras/proveedores/:id",
    "/compras/aging", "/compras/reportes", "/compras/conciliacion",
    // Legacy redirects (preservan querystring)
    "/cxp", "/cxp/por-capturar", "/cxp/por-pagar", "/proveedores", "/proveedores/:id",
    "/cartera",
    "/tesoreria", "/tesoreria/cuentas", "/tesoreria/conciliacion", "/tesoreria/flujo",
    "/comisiones",
    "/costeo", "/costeo/tarifas", "/costeo/buscar", "/costeo/rutas",
    "/costeo/agentes", "/costeo/navieras", "/costeo/demoras-venta",
    "/profit", "/profit/dashboard", "/profit/proyeccion",
    "/profit/estado-resultados", "/profit/presupuesto",
    "/clientes", "/clientes/:id",
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

describe("routes/appRoutes — gates de rol", () => {
  const CASES: Array<[string, AppRole[]]> = [
    ["/compras", COMPRAS_READ_ROLES],
    ["/compras/aging", COMPRAS_READ_ROLES],
    ["/compras/por-aprobar", COMPRAS_READ_ROLES],
    ["/compras/facturas", FINANCE_READ_ROLES],
    ["/compras/pagos", FINANCE_READ_ROLES],
    ["/compras/notas-credito", FINANCE_READ_ROLES],
    ["/compras/reportes", FINANCE_READ_ROLES],
    ["/compras/conciliacion", COMPRAS_READ_ROLES],
    ["/compras/por-pagar", ["admin", "super_admin", "admin_org", "tesorero", "gerente_operaciones", "gerente_visor"]],
    ["/cartera", ["admin", "super_admin", "admin_org", "contador", "tesorero", "ejecutivo_cobranza", "gerente_operaciones", "gerente_visor"]],
    ["/tesoreria", TESORERIA_READ_ROLES],
    ["/tesoreria/cuentas", TESORERIA_READ_ROLES],
    ["/tesoreria/conciliacion", TESORERIA_READ_ROLES],
    ["/tesoreria/flujo", TESORERIA_READ_ROLES],
    ["/profit/dashboard", PROFIT_READ_ROLES],
    ["/profit/presupuesto", PROFIT_READ_ROLES],
    ["/papelera", ["admin", "super_admin"]],
    ["/idempotencia", ["admin", "super_admin"]],
    ["/auditoria", AUDITORIA_ROLES],
    ["/usuarios", ["admin", "admin_org", "super_admin"]],
    ["/configuracion", ["admin", "admin_org", "contador", "super_admin"]],
  ];

  it.each(CASES)("%s conserva allowedRoles exacto", (path, expected) => {
    const roles = getRolesFor(records, path);
    expect(roles).not.toBeNull();
    expect(roles).toEqual(expected);
  });
});

describe("routes/appRoutes — redirecciones", () => {
  it.each([
    ["/costeo", "/costeo/tarifas"],
    ["/profit", "/profit/dashboard"],
    ["/reportes", "/reportes/rentabilidad"],
    ["/rentabilidad", "/reportes/rentabilidad"],
    ["/facturacion/por-emitir", "/proformas?estado=aceptada"],
  ])("%s redirige a %s con Navigate replace", (from, to) => {
    const rec = records.find((r) => r.path === from);
    expect(rec?.element).toBeTruthy();
    const props = rec!.element!.props as { to?: string; replace?: boolean };
    expect(props.to).toBe(to);
    expect(props.replace).toBe(true);
  });

  it.each([
    ["/cxp", "/compras/facturas"],
    ["/cxp/por-capturar", "/compras/por-capturar"],
    ["/cxp/por-pagar", "/compras/por-pagar"],
    ["/proveedores", "/compras/proveedores"],
  ])("%s redirige a %s preservando querystring", (from, to) => {
    const rec = records.find((r) => r.path === from);
    expect(rec?.element).toBeTruthy();
    expect(rec!.element!.type).toBe(RedirectPreserveSearch);
    const props = rec!.element!.props as { to?: string };
    expect(props.to).toBe(to);
  });
});
