import { describe, expect, it, vi } from "vitest";
import type { AppRole } from "@/types/appRole";
import {
  APROBAR_FACTURA_PROVEEDOR, CAPTURAR_FACTURA_PROVEEDOR, CREAR_EMBARQUE_BORRADOR,
  EMITIR_FACTURA_CLIENTE, PAGAR_PROVEEDOR, PROFORMAS_ESCRITURA, REGISTRAR_COBRO,
  SALES, TENANT_ADMINS, hasRole, resolverPermisosCrm,
} from "@/lib/access/permissionMatrix";
import { hasRouteAccess } from "@/lib/access/roleRouteMatrix";
import { resolverRutasVisiblesPrimerosPasos } from "../../hooks/primerosPasosMenu";
import {
  seleccionarPrimerosPasos,
  type ContextoPrimerosPasos, type PermisosPrimerosPasos,
} from "../primerosPasos";

function permisosPara(role: AppRole | null): PermisosPrimerosPasos {
  const crm = resolverPermisosCrm(role, "usuario-ficticio");
  return {
    canAdminTenant: hasRole(TENANT_ADMINS, role),
    canWriteCotizaciones: hasRole(SALES, role),
    canCrearEmbarqueDesdeCotizacion: hasRole(CREAR_EMBARQUE_BORRADOR, role),
    canEditarProforma: hasRole(PROFORMAS_ESCRITURA, role),
    canEmitirFactura: hasRole(EMITIR_FACTURA_CLIENTE, role),
    canCapturarFacturaProveedor: hasRole(CAPTURAR_FACTURA_PROVEEDOR, role),
    canAprobarFacturaProveedor: hasRole(APROBAR_FACTURA_PROVEEDOR, role),
    canPagarProveedor: hasRole(PAGAR_PROVEEDOR, role),
    canRegistrarCobro: hasRole(REGISTRAR_COBRO, role),
    canCrearLead: crm.canCrearLead,
    canCrearOportunidad: crm.canCrearOportunidad,
    canCrearActividad: crm.canCrearActividad,
    canConfigurarCrm: crm.canConfigurarCrm,
  };
}

function contexto(role: AppRole | null, cambios: Partial<ContextoPrimerosPasos> = {}): ContextoPrimerosPasos {
  const c = {
    userId: "usuario-ficticio", role, effectiveRole: role, organizationId: "empresa-ficticia",
    loading: false, profileError: false, errorOrganizaciones: false,
    permisos: permisosPara(role), ...cambios,
  };
  const menu = resolverRutasVisiblesPrimerosPasos(c.role, c.effectiveRole);
  return { ...c, esRutaVisible: (path) => menu.has(path) && (cambios.esRutaVisible?.(path) ?? true) };
}

const ids = (c: ContextoPrimerosPasos) => seleccionarPrimerosPasos(c).tareas.map((t) => t.id);
const enlaces = (c: ContextoPrimerosPasos) => seleccionarPrimerosPasos(c).tareas.flatMap((t) => t.enlaces);

const casosRoles: [AppRole, string[]][] = [
  ["super_admin", ["cotizar", "operacion", "proforma", "emision", "captura-cxp", "pagos", "cobranza", "configuracion"]],
  ["admin_org", ["cotizar", "operacion", "proforma", "emision", "captura-cxp", "pagos", "cobranza", "configuracion"]],
  ["admin", ["cotizar", "operacion", "proforma", "emision", "captura-cxp", "pagos", "cobranza", "configuracion"]],
  ["gerente_operaciones", ["cotizar", "operacion", "proforma"]],
  ["gerente_comercial", ["cotizar"]],
  ["gerente_visor", []],
  ["coordinador_logistico", ["cotizar", "operacion", "proforma"]],
  ["operador", ["cotizar", "operacion", "proforma"]],
  ["ejecutivo_pricing", ["cotizar"]],
  ["vendedor", ["cotizar"]],
  ["customer_service", ["cotizar"]],
  ["viewer", []],
  ["contador", ["proforma", "emision", "captura-cxp", "cobranza"]],
  ["tesorero", ["pagos", "cobranza"]],
  ["auxiliar_contable", ["captura-cxp"]],
  ["ejecutivo_cobranza", ["cobranza"]],
  ["cliente", []],
  ["agente_carga", []],
];

describe("primeros pasos: tareas de los 18 roles existentes", () => {
  it.each(casosRoles)("%s recibe tareas compatibles con sus capacidades y menú", (role, esperadas) => {
    const c = contexto(role);
    const resultado = seleccionarPrimerosPasos(c);
    const tareasDeAccion = resultado.tareas.filter((t) => ![
      "pricing", "consulta", "plataforma", "portal-cliente", "portal-agente",
    ].includes(t.id));
    expect(resultado.estado).toBe("disponible");
    expect(tareasDeAccion.map((t) => t.id)).toEqual(esperadas);
    if (role === "cliente" || role === "agente_carga") {
      const ruta = role === "cliente" ? "/portal" : "/agente";
      expect(enlaces(c).length).toBeGreaterThan(0);
      expect(enlaces(c).map((e) => e.href)).toEqual([ruta]);
      return;
    }
    const menu = resolverRutasVisiblesPrimerosPasos(role, role);
    for (const e of enlaces(c)) {
      expect(hasRouteAccess(role, e.href)).toBe(true);
      expect(menu.has(e.href.split("?")[0])).toBe(true);
    }
  });

  it("separa el visor heredado de Atención a Clientes aunque compartan menú", () => {
    expect(ids(contexto("customer_service"))).toContain("cotizar");
    expect(ids(contexto("viewer"))).toEqual(["consulta"]);
    expect(ids(contexto("gerente_visor"))).toEqual(["consulta"]);
    const consulta = seleccionarPrimerosPasos(contexto("viewer")).tareas[0];
    expect(consulta.descripcion).toContain("Estos accesos son de consulta");
  });

  it("no convierte el acceso a CRM del gerente de Operaciones en una invitación a escribir", () => {
    const c = contexto("gerente_operaciones");
    expect(hasRouteAccess(c.effectiveRole, "/crm")).toBe(true);
    const cotizar = seleccionarPrimerosPasos(c).tareas.find((t) => t.id === "cotizar");
    expect(cotizar?.enlaces.map((e) => e.href)).not.toContain("/crm");
    expect(enlaces(contexto("vendedor")).some((e) => e.href === "/crm")).toBe(true);
  });

  it("no ofrece altas de clientes ni creación de embarques a vendedor/Pricing", () => {
    for (const role of ["vendedor", "ejecutivo_pricing"] as const) {
      expect(ids(contexto(role))).not.toContain("operacion");
      expect(enlaces(contexto(role)).some((e) => e.href === "/embarques/nuevo")).toBe(false);
    }
    expect(enlaces(contexto("auxiliar_contable")).some((e) => e.href === "/clientes")).toBe(false);
  });
});

describe("primeros pasos: identidad y organización", () => {
  it.each([
    ["cargando", { loading: true }],
    ["sin-sesion", { userId: null }],
    ["error-perfil", { profileError: true }],
    ["error-organizaciones", { errorOrganizaciones: true }],
    ["sin-rol", { effectiveRole: null }],
    ["sin-organizacion", { organizationId: null }],
  ] as const)("%s no ofrece tareas de un contexto previo", (estado, cambio) => {
    expect(seleccionarPrimerosPasos(contexto("admin_org", cambio))).toEqual({
      estado, contexto: null, tareas: [],
    });
  });

  it("Ayuda pública no personaliza usando roles residuales de una sesión anterior", () => {
    const c = contexto("admin_org", { userId: null, profileError: true });
    expect(seleccionarPrimerosPasos(c).estado).toBe("sin-sesion");
    expect(enlaces(c)).toEqual([]);
  });

  it.each(["cliente", "agente_carga"] as const)("el rol global %s conserva su portal frente a membresías internas", (role) => {
    const c = contexto(role, {
      effectiveRole: "admin_org", permisos: permisosPara("admin_org"),
      organizationId: null, errorOrganizaciones: true,
    });
    expect(ids(c)).toEqual([role === "cliente" ? "portal-cliente" : "portal-agente"]);
    expect(resolverRutasVisiblesPrimerosPasos(role, "admin_org").size).toBe(0);
    expect(enlaces(c).map((e) => e.href)).toEqual([role === "cliente" ? "/portal" : "/agente"]);
  });

  it("usa el rol efectivo para módulos internos y rechaza super_admin sólo en membresía", () => {
    const c = contexto("vendedor", { effectiveRole: "contador", permisos: permisosPara("contador") });
    expect(ids(c)).toContain("emision");
    expect(ids(c)).not.toContain("cotizar");
    expect(seleccionarPrimerosPasos(contexto("vendedor", {
      effectiveRole: "super_admin", permisos: permisosPara("super_admin"),
    })).estado).toBe("sin-rol");
  });

  it("sin empresa, Super Admin sólo recibe el contexto de plataforma", () => {
    const c = contexto("super_admin", { organizationId: null });
    expect(seleccionarPrimerosPasos(c).contexto).toBe("plataforma");
    expect(enlaces(c).map((e) => e.href)).toEqual(["/admin"]);
    expect(seleccionarPrimerosPasos(contexto("super_admin")).contexto).toBe("organizacion");
    expect(ids(contexto("super_admin"))).toContain("plataforma");
  });
});

describe("primeros pasos: permisos concretos e intersección de visibilidad", () => {
  it("revocar una capacidad elimina esa tarea aunque el rol y la ruta sigan permitidos", () => {
    const c = contexto("admin_org");
    c.permisos = { ...c.permisos, canWriteCotizaciones: false, canEmitirFactura: false, canPagarProveedor: false };
    expect(ids(c)).not.toEqual(expect.arrayContaining(["cotizar", "emision", "pagos"]));
    for (const id of ["cotizar", "emision", "pagos"]) expect(ids(c)).not.toContain(id);
    expect(ids(c)).toContain("captura-cxp");
  });

  it("capturar, aprobar, pagar, emitir y cobrar permanecen separados", () => {
    const contador = seleccionarPrimerosPasos(contexto("contador"));
    const cxp = contador.tareas.find((t) => t.id === "captura-cxp");
    expect(cxp?.enlaces.map((e) => e.href)).toEqual(["/compras/por-capturar", "/compras/por-aprobar"]);
    const auxiliar = seleccionarPrimerosPasos(contexto("auxiliar_contable"));
    expect(auxiliar.tareas.find((t) => t.id === "captura-cxp")?.enlaces.map((e) => e.href))
      .toEqual(["/compras/por-capturar"]);
    expect(ids(contexto("contador"))).not.toContain("pagos");
    expect(ids(contexto("tesorero"))).not.toContain("captura-cxp");
    expect(ids(contexto("ejecutivo_cobranza"))).not.toContain("emision");
  });

  it("la aprobación sin captura no promete capturar y sobrevive a la restricción de su otra ruta", () => {
    const c = contexto("contador", { esRutaVisible: (path) => path !== "/compras/por-capturar" });
    const tarea = seleccionarPrimerosPasos(c).tareas.find((t) => t.id === "captura-cxp");
    expect(tarea?.titulo).toBe("Revisar facturas por aprobar");
    expect(tarea?.enlaces.map((e) => e.href)).toEqual(["/compras/por-aprobar"]);
    expect(tarea?.descripcion).not.toContain("abre la captura");
  });

  it("normaliza queries al pathname, conservando el deep link de destino", () => {
    const esRutaVisible = vi.fn((path: string) => path.length > 0);
    const c = contexto("contador", { esRutaVisible });
    expect(enlaces(c).map((e) => e.href)).toEqual(expect.arrayContaining([
      "/proformas?estado=aceptada", "/facturacion?bandeja=por-timbrar",
    ]));
    expect(esRutaVisible.mock.calls.every(([path]) => !path.includes("?"))).toBe(true);
    expect(esRutaVisible).toHaveBeenCalledWith("/facturacion");
    expect(esRutaVisible).toHaveBeenCalledWith("/proformas");
  });

  it("un override afirmativo no amplía matriz, menú ni la jerarquía de rutas", () => {
    const c = contexto("auxiliar_contable", { permisos: permisosPara("admin_org"), esRutaVisible: () => true });
    c.esRutaVisible = () => true;
    expect(ids(c)).not.toContain("emision");
    expect(ids(c)).not.toContain("cotizar");
    expect(ids(c)).not.toContain("configuracion");
    expect(enlaces(c).some((e) => e.href.startsWith("/facturacion"))).toBe(false);
    expect(enlaces(c).some((e) => e.href === "/clientes")).toBe(false);
  });

  it("el menú real conserva destinos omitidos aunque la matriz los permita", () => {
    expect(hasRouteAccess("vendedor", "/embarques")).toBe(true);
    expect(resolverRutasVisiblesPrimerosPasos("vendedor", "vendedor").has("/embarques")).toBe(false);
    const c = contexto("vendedor", { permisos: permisosPara("admin_org"), esRutaVisible: () => true });
    expect(ids(c)).not.toContain("operacion");
    expect(ids(c)).not.toContain("proforma");
  });

  it("ocultar todos los destinos no deja tarjetas vacías ni usa Ayuda como bypass", () => {
    const c = contexto("admin_org", { esRutaVisible: () => false });
    expect(ids(c)).toEqual([]);
    expect(ids(contexto("cliente", { esRutaVisible: () => false }))).toEqual(["portal-cliente"]);
  });

  it("el fallback de pagos sigue siendo visible y conciliación es una consulta separada", () => {
    const c = contexto("tesorero", { esRutaVisible: (path) => path !== "/compras/por-pagar" });
    const resultado = seleccionarPrimerosPasos(c);
    expect(resultado.tareas.find((t) => t.id === "pagos")?.enlaces[0].href).toBe("/compras/facturas");
    expect(resultado.tareas.find((t) => t.id === "consulta")?.enlaces)
      .toContainEqual({ etiqueta: "Revisar conciliación", href: "/tesoreria/conciliacion" });
    expect(resultado.tareas.find((t) => t.id === "pagos")?.enlaces)
      .not.toContainEqual(expect.objectContaining({ href: "/tesoreria/conciliacion" }));
  });

  it("recalcula sin acumular tareas de otra empresa, sesión o rol", () => {
    const anterior = contexto("admin_org");
    const snapshot = { ...anterior, permisos: { ...anterior.permisos } };
    const resultadoAnterior = seleccionarPrimerosPasos(anterior);
    const nuevo = contexto("viewer", { organizationId: "otra-empresa-ficticia", userId: "otra-persona-ficticia" });
    expect(ids(nuevo)).toEqual(["consulta"]);
    expect(anterior).toEqual(snapshot);
    expect(resultadoAnterior.tareas.map((t) => t.id)).toContain("emision");
    expect(enlaces(nuevo).some((e) => e.href.startsWith("/compras"))).toBe(false);
  });
});
