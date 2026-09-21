/**
 * Paso 10 de la auditoría: propiedad canónica de las keys.
 * Cada factory nueva debe devolver EXACTAMENTE la tupla que antes se armaba a
 * mano en el consumidor (shape congelado).
 */
import { describe, it, expect } from "vitest";
import { queryKeys } from "@/lib/query";

describe("keys centralizadas (paso 10)", () => {
  it("clientes.autorizacion", () => {
    expect(queryKeys.clientes.autorizacion("c1")).toEqual(["cliente-autorizacion", "c1"]);
    expect(queryKeys.clientes.autorizacion(null)).toEqual(["cliente-autorizacion", "none"]);
  });

  it("facturacion.all", () => {
    expect(queryKeys.facturacion.all).toEqual(["facturacion"]);
  });

  it("crm: lead-nombre, duplicados, oportunidad-moneda y actividades.paged", () => {
    expect(queryKeys.crm.leadNombre("l1")).toEqual(["crm", "lead-nombre", "l1"]);
    const claves = [{ empresa: "ACME", email: "a@b.c", telefono: "55" }];
    expect(queryKeys.crm.leads.duplicados(claves)).toEqual([
      "crm", "leads", "duplicados", claves,
    ]);
    expect(queryKeys.crm.leads.duplicado("ACME", "a@b.c", "55")).toEqual([
      "crm", "leads", "duplicado", "ACME", "a@b.c", "55",
    ]);
    expect(queryKeys.crm.oportunidadMoneda("o1")).toEqual([
      "crm", "oportunidad-moneda", "o1",
    ]);
    expect(queryKeys.crm.actividades.paged("u1")).toEqual([
      "crm", "actividades", "paged", "u1",
    ]);
    expect(queryKeys.crm.actividades.paged("u1", "vencidas")).toEqual([
      "crm", "actividades", "paged", "u1", "vencidas",
    ]);
    expect(queryKeys.crm.actividades.paged("u1", "todas")).toEqual([
      "crm", "actividades", "paged", "u1", "todas",
    ]);
  });

  it("cotizaciones.filtrosTarifa", () => {
    expect(queryKeys.cotizaciones.filtrosTarifa("q1")).toEqual([
      "cotizacion", "q1", "filtros-tarifa",
    ]);
  });

  it("costeo.diagnosticoTarifas ordena los tipos de contenedor", () => {
    expect(
      queryKeys.costeo.diagnosticoTarifas({
        organizationId: "org",
        puertoOrigenId: "po",
        puertoDestinoId: "pd",
        tipoContenedorIds: ["b", "a"],
        hoy: "2026-09-21",
      }),
    ).toEqual([
      "costeo", "diagnostico-tarifas", "org", "po", "pd", ["a", "b"], "2026-09-21",
    ]);
  });

  it("proveedores.movimientos con periodo y paginación", () => {
    expect(queryKeys.proveedores.movimientos("p1", "2026-01-01", "2026-01-31", 50, 0)).toEqual([
      "proveedores", "movimientos", "p1", "2026-01-01", "2026-01-31", 50, 0,
    ]);
    expect(queryKeys.proveedores.movimientos("p1")).toEqual([
      "proveedores", "movimientos", "p1", "", "", "", "",
    ]);
  });

  it("tesoreria.libroPagos y tieneMovimientos", () => {
    expect(queryKeys.tesoreria.libroPagos("2026-01-01", "2026-01-31", "org")).toEqual([
      "tesoreria", "libro-pagos", "2026-01-01", "2026-01-31", "org",
    ]);
    expect(queryKeys.tesoreria.tieneMovimientos("c1")).toEqual([
      "tesoreria", "tiene-movimientos", "c1",
    ]);
  });

  it("compras: las cuatro keys incluyen organizationId al final", () => {
    const conc = { estado: "todos", moneda: "todas", search: "" };
    expect(queryKeys.compras.conciliacionEmbarques(conc, "org")).toEqual([
      "compras", "conciliacion-embarques", conc, "org",
    ]);
    const nc = { desde: "a", hasta: "b", moneda: "MXN", estado: "todos", search: "" };
    expect(queryKeys.compras.notasCreditoGlobal(nc, "org")).toEqual([
      "compras", "notas-credito-global", nc, "org",
    ]);
    const pagos = { desde: "a", hasta: "b", moneda: "MXN", metodoPago: "todos", search: "" };
    expect(queryKeys.compras.pagosGlobal(pagos, "org")).toEqual([
      "compras", "pagos-global", pagos, "org",
    ]);
    const rep = { desde: "a", hasta: "b" };
    expect(queryKeys.compras.reportes(rep, "org")).toEqual([
      "compras", "reportes", rep, "org",
    ]);
  });

  it("cxc.aging y cxp.aging / agingByOrg", () => {
    expect(queryKeys.cxc.aging(undefined, "org")).toEqual(["cxc", "aging", "hoy", "org"]);
    // El prefijo por fecha se conserva (lo invalida useCerrarFacturaSinPago).
    expect(queryKeys.cxp.aging()).toEqual(["cxp", "aging", "hoy"]);
    expect(queryKeys.cxp.agingByOrg("2026-09-21", "org")).toEqual([
      "cxp", "aging", "2026-09-21", "org",
    ]);
  });

  it("cxp: badge del buzón conserva prefijo y agrega key por organización", () => {
    expect(queryKeys.cxp.facturasEntrantesPorCapturarCount).toEqual([
      "cxp", "facturas-entrantes", "por-capturar-count",
    ]);
    expect(queryKeys.cxp.facturasEntrantesPorCapturarCountByOrg("org")).toEqual([
      "cxp", "facturas-entrantes", "por-capturar-count", "org",
    ]);
    expect(queryKeys.cxp.facturasEntrantesPorCapturarCountByOrg(null)).toEqual([
      "cxp", "facturas-entrantes", "por-capturar-count", "sin-org",
    ]);
  });

  it("embarques es dueño de byCotizacion y de los roots de conceptos", () => {
    expect(queryKeys.embarques.byCotizacion("q1")).toEqual(["embarques", "cotizacion", "q1"]);
    expect(queryKeys.embarques.conceptosVenta()).toEqual(["conceptos_venta"]);
    expect(queryKeys.embarques.conceptosVenta("e1")).toEqual(["conceptos_venta", "e1"]);
    expect(queryKeys.embarques.conceptosCosto()).toEqual(["conceptos_costo"]);
    expect(queryKeys.embarques.conceptosCosto("e1")).toEqual(["conceptos_costo", "e1"]);
  });

  it("las keys mudadas ya no viven en su dominio anterior", () => {
    expect("embarquesVinculados" in queryKeys.cotizaciones).toBe(false);
    expect("conceptosVenta" in queryKeys.proformas).toBe(false);
  });
});
