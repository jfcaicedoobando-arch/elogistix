import { describe, it, expect } from "vitest";
import { queryKeys } from "@/lib/query";

/**
 * Snapshot del shape de `queryKeys`. Falla si añadimos/quitamos dominios sin
 * pensarlo dos veces. Para añadir un dominio nuevo, actualiza este array.
 *
 * Refactor 11.60.0 (Bloque B4): protege la paridad del split por dominio.
 */
const EXPECTED_DOMAINS = [
  "embarques", "proformas", "cotizaciones", "clientes", "facturas",
  "proveedores", "configuracion", "trackingLinks",
  "clienteFinancials", "puertos", "exchangeRates", "bitacora", "dashboard",
  "operadores", "operaciones", "reportes", "configuracionGlobal", "planes",
  "configuracionOrg", "navieras", "tiposContenedor", "portal", "sidebar",
  "usuarios", "admin", "crm", "auditoria", "appLogs", "facturacion", "profit",
  "papelera", "idempotenciaLog", "pdfPreviewCotizacion", "trackingPublico",
  "cxp", "tesoreria", "comisiones", "presupuesto", "dashboardEjecutivo",
  "usuariosPortalCliente", "usuariosPortalAgente",
  "costeo", "portalAgente", "proveedorFacturas", "proveedorNotasCredito",
  "pagosProveedor", "bbvaMovimientos", "proveedorSalud", "conceptosCosto",
  "bandejas", "productosCatalogo", "direccion", "dashboardOperador",
  "embarquesPendientesAdmin", "alertasSistema", "demoLeads", "notificaciones",
  "marketing", "cxc",
] as const;

describe("queryKeys shape", () => {
  it("expone todos los dominios esperados (diff simétrico explícito)", () => {
    const actual = new Set(Object.keys(queryKeys));
    const expected = new Set<string>(EXPECTED_DOMAINS);
    const missing = [...expected].filter((d) => !actual.has(d));
    const extra = [...actual].filter((d) => !expected.has(d));
    expect(missing, `Dominios esperados que NO están en queryKeys: ${missing.join(", ") || "ninguno"}`).toEqual([]);
    expect(extra, `Dominios en queryKeys NO declarados en EXPECTED_DOMAINS: ${extra.join(", ") || "ninguno"}`).toEqual([]);
  });

  it("dominios tipo factory (funciones) se invocan sin reventar", () => {
    expect(queryKeys.papelera("clientes")).toEqual(["papelera", "clientes"]);
    expect(queryKeys.pdfPreviewCotizacion("id-1")).toEqual([
      "pdf-preview-cotizacion", "id-1",
    ]);
    expect(queryKeys.trackingPublico("tok")).toEqual(["tracking-public", "tok"]);
  });

  it("crm.leads tiene la API esperada", () => {
    expect(queryKeys.crm.leads.all).toEqual(["crm", "leads"]);
    expect(queryKeys.crm.leads.detail("x")).toEqual(["crm", "leads", "detail", "x"]);
  });

  it("embarques.list es estable", () => {
    expect(queryKeys.embarques.list({ q: "a" })).toEqual([
      "embarques", "list", { q: "a" },
    ]);
  });
});
