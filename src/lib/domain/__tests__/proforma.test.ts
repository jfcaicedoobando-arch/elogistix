/**
 * Tests unitarios para la lógica de dominio pura de proformas.
 */
import { describe, it, expect } from "vitest";
import {
  calcularTotalesProforma,
  agruparProformasPendientes,
  montoPrincipalProforma,
  totalesProformasSeleccionadas,
  type ConceptoVentaLite,
  type ProformaPendienteLite,
} from "@/lib/domain/proforma";

describe("calcularTotalesProforma", () => {
  const tasa = 0.16;

  it("retorna ceros cuando no hay conceptos", () => {
    const r = calcularTotalesProforma([], tasa);
    expect(r).toEqual({
      subtotal_usd: 0, iva_usd: 0, total_usd: 0,
      subtotal_mxn: 0, iva_mxn: 0, total_mxn: 0,
    });
  });

  it("MXN siempre lleva IVA", () => {
    const conceptos: ConceptoVentaLite[] = [
      { id: "1", cantidad: 2, precio_unitario: 100, moneda: "MXN" },
      { id: "2", cantidad: 1, precio_unitario: 50, moneda: "MXN", aplica_iva: false },
    ];
    const r = calcularTotalesProforma(conceptos, tasa);
    expect(r.subtotal_mxn).toBe(250);
    expect(r.iva_mxn).toBeCloseTo(40);
    expect(r.total_mxn).toBeCloseTo(290);
  });

  it("USD respeta el flag aplica_iva del concepto", () => {
    const conceptos: ConceptoVentaLite[] = [
      { id: "a", cantidad: 1, precio_unitario: 100, moneda: "USD", aplica_iva: true },
      { id: "b", cantidad: 1, precio_unitario: 200, moneda: "USD", aplica_iva: false },
    ];
    const r = calcularTotalesProforma(conceptos, tasa);
    expect(r.subtotal_usd).toBe(300);
    expect(r.iva_usd).toBeCloseTo(16);
    expect(r.total_usd).toBeCloseTo(316);
  });

  it("USD aplica overrides del usuario sobre el flag del concepto", () => {
    const conceptos: ConceptoVentaLite[] = [
      { id: "a", cantidad: 1, precio_unitario: 100, moneda: "USD", aplica_iva: false },
    ];
    const r = calcularTotalesProforma(conceptos, tasa, { a: true });
    expect(r.iva_usd).toBeCloseTo(16);
  });

  it("admite cantidades y precios como string", () => {
    const conceptos: ConceptoVentaLite[] = [
      { id: "x", cantidad: "3", precio_unitario: "10", moneda: "MXN" },
    ];
    const r = calcularTotalesProforma(conceptos, tasa);
    expect(r.subtotal_mxn).toBe(30);
  });
});

describe("agruparProformasPendientes", () => {
  const make = (over: Partial<ProformaPendienteLite>): ProformaPendienteLite => ({
    id: "p1", numero: "P-1", expediente: "EXP-001",
    embarque_id: "e1", cliente_id: "c1", cliente_nombre: "Cliente",
    operador: null, dias_credito: null, bl_master: null,
    total_usd: 0, total_mxn: 0, ...over,
  });

  it("agrupa por expediente y ordena alfabéticamente", () => {
    const grupos = agruparProformasPendientes([
      make({ id: "1", expediente: "EXP-002" }),
      make({ id: "2", expediente: "EXP-001" }),
    ]);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].expediente).toBe("EXP-001");
    expect(grupos[1].expediente).toBe("EXP-002");
  });

  it("subagrupa por contenedor dentro de cada expediente", () => {
    const grupos = agruparProformasPendientes([
      make({ id: "1", expediente: "EXP-001", embarques: { contenedor: "ABC123", tipo_contenedor: "40HC" } }),
      make({ id: "2", expediente: "EXP-001", embarques: { contenedor: "ABC123", tipo_contenedor: "40HC" } }),
      make({ id: "3", expediente: "EXP-001", embarques: { contenedor: "XYZ999", tipo_contenedor: "20" } }),
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].contenedores).toHaveLength(2);
    const abc = grupos[0].contenedores.find((c) => c.contenedor === "ABC123")!;
    expect(abc.proformas).toHaveLength(2);
  });

  it("usa __sin_contenedor__ como bucket cuando no hay contenedor", () => {
    const grupos = agruparProformasPendientes([
      make({ id: "1", embarques: { contenedor: null } }),
      make({ id: "2", embarques: null }),
    ]);
    expect(grupos[0].contenedores).toHaveLength(1);
    expect(grupos[0].contenedores[0].contenedor).toBeNull();
    expect(grupos[0].contenedores[0].proformas).toHaveLength(2);
  });

  it("toma el blMaster del embarque o del campo plano de la proforma", () => {
    const grupos = agruparProformasPendientes([
      make({ id: "1", expediente: "A", bl_master: "PLANO" }),
    ]);
    expect(grupos[0].blMaster).toBe("PLANO");

    const grupos2 = agruparProformasPendientes([
      make({ id: "2", expediente: "B", bl_master: "PLANO", embarques: { bl_master: "DESDE-EMB" } }),
    ]);
    expect(grupos2[0].blMaster).toBe("DESDE-EMB");
  });
});

describe("montoPrincipalProforma", () => {
  it("prioriza USD si hay valor positivo", () => {
    expect(montoPrincipalProforma({ total_usd: 100, total_mxn: 500 })).toEqual({ valor: 100, moneda: "USD" });
  });
  it("cae a MXN si USD es 0 o nulo", () => {
    expect(montoPrincipalProforma({ total_usd: 0, total_mxn: 500 })).toEqual({ valor: 500, moneda: "MXN" });
    expect(montoPrincipalProforma({ total_usd: null, total_mxn: 250 })).toEqual({ valor: 250, moneda: "MXN" });
  });
  it("retorna 0 MXN cuando ambos son nulos", () => {
    expect(montoPrincipalProforma({ total_usd: null, total_mxn: null })).toEqual({ valor: 0, moneda: "MXN" });
  });
});

describe("totalesProformasSeleccionadas", () => {
  const proformas: ProformaPendienteLite[] = [
    { id: "1", numero: "P-1", expediente: "E", embarque_id: null, cliente_id: "c", cliente_nombre: "X", operador: null, dias_credito: null, bl_master: null, total_usd: 100, total_mxn: 50 },
    { id: "2", numero: "P-2", expediente: "E", embarque_id: null, cliente_id: "c", cliente_nombre: "X", operador: null, dias_credito: null, bl_master: null, total_usd: 200, total_mxn: 0 },
    { id: "3", numero: "P-3", expediente: "E", embarque_id: null, cliente_id: "c", cliente_nombre: "X", operador: null, dias_credito: null, bl_master: null, total_usd: 0, total_mxn: 999 },
  ];

  it("suma solo los seleccionados", () => {
    const r = totalesProformasSeleccionadas(proformas, new Set(["1", "2"]));
    expect(r).toEqual({ usd: 300, mxn: 50 });
  });

  it("retorna 0 si no hay selección", () => {
    expect(totalesProformasSeleccionadas(proformas, new Set())).toEqual({ usd: 0, mxn: 0 });
  });

  it("ignora ids no presentes", () => {
    expect(totalesProformasSeleccionadas(proformas, new Set(["zzz"]))).toEqual({ usd: 0, mxn: 0 });
  });
});
