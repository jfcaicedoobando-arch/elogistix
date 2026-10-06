import { describe, expect, it } from "vitest";
import { buildFilasProyeccion, indexarPorEmbarque } from "../buildFilas";
import { agruparPorExpediente, calcularKpisProyeccion } from "@/features/facturacion/domain/proyeccionFacturacion";
import { ventasPendientes, type FacturaCierre } from "../ventasPendientes";
import { buildProyeccionCsvRows } from "@/features/facturacion/domain/proyeccionCsv";

const embarque = { id: "audit127", expediente: "ELNAC16", cliente_nombre: "Cliente", operador: "",
  eta: "2026-10-05", contenedor: null, tipo_cambio_usd: 20, tipo_cambio_eur: 22, tiene_proforma: true };
const venta = indexarPorEmbarque([{ embarque_id: embarque.id, total: 200, moneda: "MXN" }], "total");
const proyectadas = [{ embarque_id: embarque.id, total: 200, moneda: "MXN" }];
function cierre(bruta: number, facturada = bruta) {
  const emitidas = bruta ? indexarPorEmbarque([{ embarque_id: embarque.id, total: facturada, moneda: "MXN" }], "total") : new Map();
  const facturas: FacturaCierre[] = bruta ? [{ id: "f1", embarque_id: embarque.id, proforma_id: null,
    subtotal: bruta, moneda: "MXN", conceptos_factura: [] }] : [];
  const pendientesMap = indexarPorEmbarque(ventasPendientes(proyectadas, facturas), "total");
  return agruparPorExpediente(buildFilasProyeccion([embarque], venta, new Map(), new Set(bruta ? ["ELNAC16"] : []), { facturadasMap: emitidas, pendientesMap }));
}
describe("audit127 monthly closure preserves partial billing", () => {
  it("200 planned,150 invoiced,50 pending including row, KPI and export", () => {
    const grupos = cierre(150);
    expect(grupos[0]).toMatchObject({ ventaMxn: 200, ventaFacturadaMxn: 150, ventaPendienteMxn: 50, estado: "Parcial" });
    expect(calcularKpisProyeccion(grupos)).toMatchObject({ ventaProyMxn: 200, ventaFacturadaMxn: 150, ventaPendienteMxn: 50, pendientes: 1 });
    expect(buildProyeccionCsvRows(grupos)[0]).toMatchObject({ venta_mxn: "200.00", facturada_mxn: "150.00", pendiente_mxn: "50.00", estado: "Parcial" });
  });
  it("remaining emission closes only50 and cancellation reopens only its amount", () => {
    expect(cierre(200)[0]).toMatchObject({ estado: "Facturado", ventaPendienteMxn: 0 });
    expect(cierre(150)[0]).toMatchObject({ estado: "Parcial", ventaPendienteMxn: 50 });
    expect(cierre(50)[0]).toMatchObject({ estado: "Parcial", ventaPendienteMxn: 150 });
    expect(cierre(0)[0]).toMatchObject({ estado: "Pendiente", ventaPendienteMxn: 200 });
  });
  it("a credit lowers net sales but never reopens already emitted concepts", () => {
    expect(cierre(150, 0)[0]).toMatchObject({ ventaMxn: 50, ventaPendienteMxn: 50, estado: "Parcial" });
    expect(cierre(200, 0)[0]).toMatchObject({ ventaMxn: 0, ventaPendienteMxn: 0, estado: "Facturado" });
    expect(cierre(200, 150)[0]).toMatchObject({ ventaMxn: 150, ventaFacturadaMxn: 150,
      ventaPendienteMxn: 0, estado: "Facturado" });
    expect(cierre(150, 130)[0]).toMatchObject({ ventaMxn: 180, ventaFacturadaMxn: 130,
      ventaPendienteMxn: 50, estado: "Parcial" });
  });
  it("issued amounts do not depend on PDF or proforma booleans", () => {
    const rows = buildFilasProyeccion([{ ...embarque, tiene_proforma: false }], venta, new Map(), new Set(), {
      facturadasMap: indexarPorEmbarque([{ embarque_id: embarque.id, total: 150, moneda: "MXN" }], "total") });
    expect(agruparPorExpediente(rows)[0].estado).toBe("Parcial");
  });
  it("invoices above forecast never create negative pending", () => {
    expect(cierre(250)[0]).toMatchObject({ ventaMxn: 250, ventaFacturadaMxn: 250, ventaPendienteMxn: 0, estado: "Facturado" });
  });
});
