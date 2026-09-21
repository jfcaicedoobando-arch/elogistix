/**
 * Paso 13 de la auditoría — semántica efectiva de la matriz ruta→roles.
 *
 * `ProtectedRoute` evalúa con `anyRoleSatisfies` (jerarquía espejo de
 * `public.has_role()`), mientras `hasRouteAccess` (sidebar / búsqueda) compara
 * con `includes` EXACTO. Esa diferencia ya existía y es REAL: la jerarquía
 * concede más accesos. No se alinea en este paso para no ampliar permisos
 * visibles en silencio; queda fijada aquí como inventario para que cualquier
 * cambio futuro sea deliberado.
 */
import { describe, it, expect } from "vitest";
import {
  ROLE_ROUTE_MATRIX,
  getRouteRoles,
  hasRouteAccess,
  COMPRAS_READ_ROLES,
  COMPRAS_HUB_ROLES,
  COMPRAS_AGING_ROLES,
  EMBARQUES_ROLES,
  FACTURACION_ROLES,
  PROFORMAS_READ_ROLES,
  FINANCE_READ_ROLES,
  PROVEEDORES_ROLES,
  CLIENTES_ROLES,
  COTIZACIONES_ROLES,
  type RouteAccessKey,
} from "@/lib/access/roleRouteMatrix";
import { ROLE_EQUIVALENTS, anyRoleSatisfies } from "@/lib/auth/roleHierarchy";
import type { AppRole } from "@/types/appRole";

const TODOS_LOS_ROLES = Object.keys(ROLE_EQUIVALENTS) as AppRole[];
const CLAVES = Object.keys(ROLE_ROUTE_MATRIX) as RouteAccessKey[];

/**
 * Inventario congelado de pares `ruta|rol` donde la jerarquía de
 * `anyRoleSatisfies` concede acceso y el `includes` de `hasRouteAccess` no.
 */
const DIVERGENCIAS = new Set<string>([
  "/embarques|tesorero",
  "/embarques|auxiliar_contable",
  "/embarques|ejecutivo_cobranza",
  "/embarques/nuevo|tesorero",
  "/embarques/nuevo|auxiliar_contable",
  "/embarques/nuevo|ejecutivo_cobranza",
  "/facturacion|auxiliar_contable",
  "/facturacion|ejecutivo_pricing",
  "/facturacion/por-emitir|auxiliar_contable",
  "/facturacion/por-emitir|ejecutivo_pricing",
  "/proformas|auxiliar_contable",
  "/proformas|ejecutivo_pricing",
  "/proformas|gerente_comercial",
  "/cobranza|auxiliar_contable",
  "/cartera|auxiliar_contable",
  "/cobranza/aging|auxiliar_contable",
  "/tesoreria|auxiliar_contable",
  "/tesoreria/cuentas|auxiliar_contable",
  "/tesoreria/conciliacion|auxiliar_contable",
  "/tesoreria/estado-cuenta|auxiliar_contable",
  "/tesoreria/pagos|auxiliar_contable",
  "/tesoreria/flujo|auxiliar_contable",
  "/tesoreria/pagos-programados|auxiliar_contable",
  "/comisiones|auxiliar_contable",
  "/profit|auxiliar_contable",
  "/profit/dashboard|auxiliar_contable",
  "/profit/proyeccion|auxiliar_contable",
  "/profit/estado-resultados|auxiliar_contable",
  "/profit/presupuesto|auxiliar_contable",
  "/clientes|tesorero",
  "/clientes|auxiliar_contable",
  "/cotizaciones|contador",
  "/cotizaciones|tesorero",
  "/cotizaciones|auxiliar_contable",
  "/cotizaciones|ejecutivo_cobranza",
  "/cotizaciones/nueva|contador",
  "/cotizaciones/nueva|tesorero",
  "/cotizaciones/nueva|auxiliar_contable",
  "/cotizaciones/nueva|ejecutivo_cobranza",
  "/cotizaciones/nueva/tarifario|contador",
  "/cotizaciones/nueva/tarifario|tesorero",
  "/cotizaciones/nueva/tarifario|auxiliar_contable",
  "/cotizaciones/nueva/tarifario|ejecutivo_cobranza",
  "/cotizaciones/plantillas|contador",
  "/cotizaciones/plantillas|tesorero",
  "/cotizaciones/plantillas|auxiliar_contable",
  "/cotizaciones/plantillas|ejecutivo_cobranza",
  "/reportes/rentabilidad|auxiliar_contable",
  "/reportes/cierre-mensual|auxiliar_contable",
  "/reportes/cartera|auxiliar_contable",
  "/bitacora|auxiliar_contable",
  "/papelera|admin_org",
  "/idempotencia|admin_org",
  "/auditoria|vendedor",
  "/auditoria|contador",
  "/auditoria|tesorero",
  "/auditoria|auxiliar_contable",
  "/auditoria|ejecutivo_cobranza",
  "/auditoria|coordinador_logistico",
  "/auditoria|ejecutivo_pricing",
  "/auditoria|gerente_operaciones",
  "/auditoria|gerente_visor",
  "/auditoria|gerente_comercial",
  "/configuracion|auxiliar_contable",
  "/rentabilidad|auxiliar_contable",
  "/reportes|auxiliar_contable",
  "/sistema/bitacora|auxiliar_contable",
]);

describe("getRouteRoles · fuente única", () => {
  it("devuelve por identidad la política declarada en la matriz", () => {
    for (const clave of CLAVES) {
      expect(getRouteRoles(clave)).toBe(ROLE_ROUTE_MATRIX[clave]);
    }
  });

  it("la matriz es inmutable en runtime", () => {
    expect(Object.isFrozen(ROLE_ROUTE_MATRIX)).toBe(true);
  });
});

describe("políticas heredadas del router (paso 13: cero cambio de acceso)", () => {
  /** El router usaba estos sets; la matriz debe contener exactamente lo mismo. */
  const esperado: Array<[RouteAccessKey, readonly AppRole[]]> = [
    ["/compras", COMPRAS_READ_ROLES],
    ["/compras/aging", COMPRAS_READ_ROLES],
    ["/embarques/:id", EMBARQUES_ROLES],
    ["/embarques/:id/editar", EMBARQUES_ROLES],
    ["/facturacion/:id", FACTURACION_ROLES],
    ["/proformas/:id", PROFORMAS_READ_ROLES],
    ["/compras/facturas/:id", FINANCE_READ_ROLES],
    ["/compras/proveedores/:id", PROVEEDORES_ROLES],
    ["/proveedores/:id", PROVEEDORES_ROLES],
    ["/clientes/:id", CLIENTES_ROLES],
    ["/clientes/:clienteId/estado-de-cuenta", FINANCE_READ_ROLES],
    ["/cotizaciones/:id", COTIZACIONES_ROLES],
    ["/cotizaciones/:id/editar", COTIZACIONES_ROLES],
    ["/dev/pdf-preview/cotizacion/:id", COTIZACIONES_ROLES],
  ];

  it.each(esperado)("%s conserva el set de roles previo", (clave, roles) => {
    expect([...getRouteRoles(clave)].sort()).toEqual([...roles].sort());
  });

  it("los alias de compras que usaban otro nombre son equivalentes", () => {
    expect([...COMPRAS_HUB_ROLES].sort()).toEqual([...COMPRAS_READ_ROLES].sort());
    expect([...COMPRAS_AGING_ROLES].sort()).toEqual([...COMPRAS_READ_ROLES].sort());
  });
});

describe("hasRouteAccess vs anyRoleSatisfies · inventario exhaustivo", () => {
  it("coinciden salvo en las divergencias declaradas", () => {
    const inesperadas: string[] = [];
    for (const clave of CLAVES) {
      const permitidos = ROLE_ROUTE_MATRIX[clave];
      for (const rol of TODOS_LOS_ROLES) {
        const porMatriz = hasRouteAccess(rol, clave);
        const porJerarquia = anyRoleSatisfies(permitidos, rol);
        if (porMatriz === porJerarquia) continue;
        const par = `${clave}|${rol}`;
        if (!DIVERGENCIAS.has(par)) inesperadas.push(par);
      }
    }
    expect(inesperadas).toEqual([]);
  });

  it("la jerarquía nunca es más estricta que la matriz", () => {
    for (const clave of CLAVES) {
      const permitidos = ROLE_ROUTE_MATRIX[clave];
      for (const rol of TODOS_LOS_ROLES) {
        if (!hasRouteAccess(rol, clave)) continue;
        expect(anyRoleSatisfies(permitidos, rol)).toBe(true);
      }
    }
  });

  it("toda divergencia declarada sigue vigente (sin baseline muerta)", () => {
    for (const par of DIVERGENCIAS) {
      const [clave, rol] = par.split("|") as [RouteAccessKey, AppRole];
      expect(hasRouteAccess(rol, clave)).toBe(false);
      expect(anyRoleSatisfies(ROLE_ROUTE_MATRIX[clave], rol)).toBe(true);
    }
  });
});
