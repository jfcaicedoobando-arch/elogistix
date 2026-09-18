import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  diferenciasCuadreFiscal,
  recalcularTotalesConceptos,
  toleranciaCentavos,
  type ConceptoCuadre,
} from "./cuadreFiscal.ts";

function concepto(p: Partial<ConceptoCuadre>): ConceptoCuadre {
  return {
    descripcion: "Flete",
    cantidad: 1,
    precio_unitario: 1000,
    tipo_iva: "gravado_16",
    tasa_iva: 0.16,
    ...p,
  };
}

Deno.test("tolerancia: un centavo por renglon con piso de un centavo", () => {
  assertEquals(toleranciaCentavos(0), 0.01);
  assertEquals(toleranciaCentavos(1), 0.01);
  assertEquals(toleranciaCentavos(3), 0.03);
});

Deno.test("no objeto 01 + gravado 16%: solo el gravado causa IVA", () => {
  const t = recalcularTotalesConceptos([
    concepto({ descripcion: "Gravado", precio_unitario: 1000 }),
    concepto({ descripcion: "No objeto", precio_unitario: 500, tipo_iva: "no_objeto", tasa_iva: 0 }),
  ]);
  assertEquals(t.subtotal, 1500);
  assertEquals(t.iva_trasladado, 160);
  assertEquals(t.total, 1660);
});

Deno.test("exento y tasa 0% no causan IVA trasladado", () => {
  const exento = recalcularTotalesConceptos([concepto({ tipo_iva: "exento", tasa_iva: 0 })]);
  assertEquals(exento.iva_trasladado, 0);
  assertEquals(exento.total, 1000);
  const tasa0 = recalcularTotalesConceptos([concepto({ tipo_iva: "tasa_0", tasa_iva: 0 })]);
  assertEquals(tasa0.iva_trasladado, 0);
  assertEquals(tasa0.total, 1000);
});

Deno.test("retenciones de IVA e ISR bajan el total", () => {
  const t = recalcularTotalesConceptos([
    concepto({ tasa_ret_iva: 0.04, tasa_ret_isr: 0.1 }),
  ]);
  assertEquals(t.iva_trasladado, 160);
  assertEquals(t.ret_iva, 40);
  assertEquals(t.ret_isr, 100);
  assertEquals(t.total, 1020);
});

Deno.test("redondeo por concepto: cada renglon se redondea a dos decimales", () => {
  const t = recalcularTotalesConceptos([
    concepto({ cantidad: 3, precio_unitario: 33.333 }),
  ]);
  assertEquals(t.subtotal, 100);
  assertEquals(t.iva_trasladado, 16);
});

Deno.test("cuadre justo debajo de la tolerancia pasa (MXN)", () => {
  const conceptos = [concepto({})];
  const d = diferenciasCuadreFiscal(conceptos, { subtotal: 1000, iva: 160, total: 1160 });
  assertEquals(d, []);
});

Deno.test("cuadre EN el limite de la tolerancia pasa", () => {
  const conceptos = [concepto({})];
  const d = diferenciasCuadreFiscal(conceptos, { subtotal: 1000.01, iva: 160, total: 1160.01 });
  assertEquals(d, []);
});

Deno.test("diferencia de 0.99 en el subtotal YA se bloquea", () => {
  const conceptos = [concepto({})];
  const d = diferenciasCuadreFiscal(conceptos, { subtotal: 999.01, iva: 160, total: 1160 });
  assertEquals(d.length, 1);
  assertEquals(d[0].startsWith("Subtotal"), true);
});

Deno.test("IVA y total inconsistentes se reportan por separado (USD)", () => {
  const conceptos = [concepto({ precio_unitario: 100 })];
  const d = diferenciasCuadreFiscal(conceptos, { subtotal: 100, iva: 0, total: 100 });
  assertEquals(d.length, 2);
  assertEquals(d[0].startsWith("IVA trasladado"), true);
  assertEquals(d[1].startsWith("Total"), true);
});

Deno.test("moneda extranjera con dos renglones: dos centavos de holgura", () => {
  const conceptos = [concepto({ precio_unitario: 100 }), concepto({ precio_unitario: 50 })];
  const d = diferenciasCuadreFiscal(conceptos, { subtotal: 150.02, iva: 24, total: 174.02 });
  assertEquals(d, []);
  const excedido = diferenciasCuadreFiscal(conceptos, { subtotal: 150.03, iva: 24, total: 174 });
  assertEquals(excedido.length, 1);
  assertEquals(excedido[0].startsWith("Subtotal"), true);
});

Deno.test("cabecera sin datos no bloquea (facturas antiguas)", () => {
  const d = diferenciasCuadreFiscal([concepto({})], { subtotal: null, iva: null, total: null });
  assertEquals(d, []);
});
