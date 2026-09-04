import { describe, it, expect } from "vitest";
import { 
  pick, 
  fmtCxc, 
  fmtCxp, 
  fmtDocs, 
  fmtMargen, 
  fmtVentaPendientes, 
  fmtSinFactura, 
  fmtContenedores, 
  fmtContenedoresFechas, 
  fmtRepPendientes,
  fmtMargenMinimoPct 
} from "../cierreCheckFormatters";

describe("cierreCheckFormatters", () => {
  it("pick: extrae valores de objetos de forma segura", () => {
    expect(pick({ a: 1 }, "a")).toBe(1);
    expect(pick(null, "a")).toBeUndefined();
    expect(pick("not an object", "a")).toBeUndefined();
  });

  it("fmtCxc: formatea saldos y facturas pendientes (legacy MXN)", () => {
    const res = fmtCxc({ total: 100, pagado: 40, facturas_pendientes: 2 });
    expect(res).toContain("2 factura(s) por cobrar");
    expect(res).toContain("60.00");

    expect(fmtCxc({ total: 100, pagado: 100, facturas_pendientes: 0 })).toBeNull();
    expect(fmtCxc({ total: 50, pagado: 49.995, facturas_pendientes: 0 })).toBeNull();
  });

  it("fmtCxc: agrupa por moneda (nuevo shape)", () => {
    const res = fmtCxc({
      por_moneda: [
        { moneda: "USD", total: 5220, pagado: 0, saldo: 5220, facturas_pendientes: 1 },
        { moneda: "MXN", total: 100, pagado: 100, saldo: 0, facturas_pendientes: 0 },
      ],
    });
    expect(res).toContain("1 factura(s) por cobrar");
    expect(res).toContain("USD");
    expect(res).toContain("5,220");
    expect(res).not.toContain("MXN");
  });

  it("fmtCxp: formatea saldos y facturas de proveedor (legacy MXN)", () => {
    const res = fmtCxp({ total: 100, pagado: 40, facturas_pendientes: 1 });
    expect(res).toContain("1 factura(s) de proveedor por pagar");
    expect(res).toContain("60.00");

    expect(fmtCxp({ total: 100, pagado: 100, facturas_pendientes: 0 })).toBeNull();
  });

  it("fmtCxp: agrupa por moneda (nuevo shape)", () => {
    const res = fmtCxp({
      por_moneda: [
        { moneda: "USD", total: 1000, pagado: 200, saldo: 800, facturas_pendientes: 1 },
        { moneda: "MXN", total: 500, pagado: 100, saldo: 400, facturas_pendientes: 1 },
      ],
    });
    expect(res).toContain("2 factura(s) de proveedor por pagar");
    expect(res).toContain("USD");
    expect(res).toContain("MXN");
  });

  it("fmtDocs: maneja arrays y números de documentos faltantes", () => {
    expect(fmtDocs({ faltantes: ["D1", "D2"] })).toBe("2 documento(s) faltante(s): D1, D2");
    expect(fmtDocs({ docs_faltantes: ["D1", "D2", "D3", "D4"] })).toBe("4 documento(s) faltante(s): D1, D2, D3…");
    expect(fmtDocs({ pendientes: 5 })).toBe("5 documento(s) faltante(s)");
    expect(fmtDocs({})).toBeNull();
  });

  it("fmtMargen: muestra utilidad y mínimo si ambos existen", () => {
    const res = fmtMargen({ utilidad: 1000, minimo: 500 });
    expect(res).toContain("1,000.00");
    expect(res).toContain("500.00");
    
    expect(fmtMargen({ utilidad: 1000 })).toBeNull();
  });

  // Auditoría ELEXP00250: sin facturas de venta la venta real es 0 y el margen
  // no existe; el texto debe explicarlo en lugar de mostrar sólo «—».
  it("fmtMargenMinimoPct: sin venta real explica que no hay facturas emitidas", () => {
    const res = fmtMargenMinimoPct({ margen_pct: null, minimo_pct: 10, venta_mxn: 0, utilidad_mxn: null });
    expect(res).toContain("Aún no hay facturas de venta emitidas");
    expect(res).toContain("10.00%");
    expect(res).not.toContain("Margen actual");
  });

  it("fmtMargenMinimoPct: con margen numérico muestra porcentaje y utilidad", () => {
    const res = fmtMargenMinimoPct({ margen_pct: -23.17, minimo_pct: 10, venta_mxn: 154180, utilidad_mxn: -35727 });
    expect(res).toContain("Margen actual -23.17%");
    expect(res).toContain("mínimo 10.00%");
    expect(res).toContain("35,727");
  });

  it("fmtMargenMinimoPct: sin detalle devuelve null", () => {
    expect(fmtMargenMinimoPct({})).toBeNull();
  });

  it("fmtVentaPendientes: muestra conceptos y proformas", () => {
    expect(fmtVentaPendientes({ pendientes: 2, en_proforma: 1 })).toBe("2 concepto(s) pendiente(s) · 1 en proforma sin facturar");
    expect(fmtVentaPendientes({ pendientes: 3 })).toBe("3 concepto(s) pendiente(s)");
    expect(fmtVentaPendientes({ en_proforma: 2 })).toBe("2 en proforma sin facturar");
    expect(fmtVentaPendientes({})).toBeNull();
  });

  it("fmtSinFactura: muestra conceptos sin factura de proveedor", () => {
    expect(fmtSinFactura({ sin_factura: 3 })).toBe("3 concepto(s) sin factura de proveedor");
    expect(fmtSinFactura({ pendientes: 2 })).toBe("2 concepto(s) sin factura de proveedor");
    expect(fmtSinFactura({})).toBeNull();
  });

  it("fmtContenedores: muestra sin peso/volumen", () => {
    expect(fmtContenedores({ contenedores_incompletos: 2 })).toBe("2 contenedor(es) sin peso/volumen");
    expect(fmtContenedores({ sin_datos: 1 })).toBe("1 contenedor(es) sin peso/volumen");
    expect(fmtContenedores({})).toBeNull();
  });

  it("fmtContenedoresFechas: muestra sin fechas", () => {
    expect(fmtContenedoresFechas({ contenedores_sin_fechas: 3 })).toBe("3 contenedor(es) sin fecha de descarga o devolución");
    expect(fmtContenedoresFechas({})).toBeNull();
  });

  it("fmtRepPendientes: muestra PPD sin REP", () => {
    expect(fmtRepPendientes({ pendientes: 4 })).toBe("4 pago(s) PPD sin REP timbrado");
    expect(fmtRepPendientes({})).toBeNull();
  });

  it("fmtMoney edge cases", () => {
     expect(fmtMargen({ utilidad: "NaN", minimo: 500 })).toContain("NaN");
  });
});
