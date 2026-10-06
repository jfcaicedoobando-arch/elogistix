import { describe, expect, it } from "vitest";
import { buildFilasProyeccion, indexarPorEmbarque } from "../buildFilas";
import { agruparPorExpediente, calcularKpisProyeccion } from "@/features/facturacion/domain/proyeccionFacturacion";
import { buildProyeccionCsvRows } from "@/features/facturacion/domain/proyeccionCsv";
import { ventasPendientes, type FacturaCierre } from "../ventasPendientes";

const embarque = { id: "sin-tc", expediente: "AUD127-SIN-TC", cliente_nombre: "Cliente", operador: "",
  eta: "2026-10-05", contenedor: null, tipo_cambio_usd: null, tipo_cambio_eur: null, tiene_proforma: true };

function filaSinTc(moneda: string, emitido: number, id = embarque.id) {
  const proyectadas = [{ embarque_id: id, proforma_id: null, total: 150, moneda }];
  const facturas: FacturaCierre[] = emitido > 0 ? [{ id: `f-${id}`, embarque_id: id,
    proforma_id: null, subtotal: emitido, moneda, conceptos_factura: [] }] : [];
  return buildFilasProyeccion([{ ...embarque, id }], indexarPorEmbarque(proyectadas, "total"),
    new Map(), new Set(), {
      tcFacturaPorExpediente: new Map([[embarque.expediente, 20]]),
      facturadasMap: indexarPorEmbarque(emitido > 0
        ? [{ embarque_id: id, total: emitido * 20, moneda: "MXN" }] : [], "total"),
      pendientesMap: indexarPorEmbarque(ventasPendientes(proyectadas, facturas), "total"),
    })[0];
}

describe("AUD127: billing coverage does not depend on exchange-rate availability", () => {
  it.each(["USD", "EUR"])("keeps the unvalued %s remainder partial in row, group, KPI and CSV", (moneda) => {
    const fila = filaSinTc(moneda, 100);
    expect(fila).toMatchObject({ sin_tc: true, venta_facturada_mxn: 2000,
      venta_pendiente_mxn: 0, venta_pendiente_usd: moneda === "USD" ? 50 : 0 });
    const grupos = agruparPorExpediente([fila]);
    expect(grupos[0]).toMatchObject({ estado: "Parcial", sinTc: true });
    expect(calcularKpisProyeccion(grupos)).toMatchObject({ pendientes: 1, facturados: 0,
      ventaFacturadaMxn: 2000, ventaPendienteMxn: 0 });
    expect(buildProyeccionCsvRows(grupos)[0].estado).toBe("Parcial");
  });

  it.each(["USD", "EUR"])("a fully covered %s sale stays billed despite missing shipment FX", (moneda) => {
    expect(agruparPorExpediente([filaSinTc(moneda, 150)])[0])
      .toMatchObject({ estado: "Facturado", sinTc: true, ventaPendienteMxn: 0, ventaPendienteUsd: 0 });
    expect(agruparPorExpediente([filaSinTc(moneda, 0)])[0].estado).toBe("Pendiente");
  });

  it.each([false, true])("preserves an unvalued EUR remainder when merging shipments (reversed=%s)", (reversed) => {
    const filas = [filaSinTc("USD", 150, "billed"), filaSinTc("EUR", 0, "pending")];
    const [grupo] = agruparPorExpediente(reversed ? filas.reverse() : filas);
    expect(grupo).toMatchObject({ estado: "Parcial", sinTc: true, ventaFacturadaMxn: 3000,
      ventaPendienteMxn: 0, ventaPendienteUsd: 0 });
    expect(calcularKpisProyeccion([grupo])).toMatchObject({ pendientes: 1, facturados: 0 });
  });
});
