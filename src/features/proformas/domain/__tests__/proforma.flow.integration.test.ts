/**
 * B.3.2 — Integración Embarque → Proforma → Factura (composición pura).
 *
 * Ejercita la cadena real:
 *   conceptos_venta crudos
 *   → calcularTotalesProforma (USD/MXN con IVA)
 *   → agruparProformasPendientes (por embarque + contenedor)
 *   → totalesProformasSeleccionadas (selección del wizard de facturación)
 *   → montoPrincipalProforma (badge en tabla)
 *
 * No mockea helpers: importa los reales para validar que la composición
 * sigue siendo coherente cuando se cambian piezas individuales.
 */
import { describe, expect, it } from "vitest";
import {
  MULTI_CONTENEDOR,
  agruparProformasPendientes,
  calcularTotalesProforma,
  montoPrincipalProforma,
  totalesProformasSeleccionadas,
  type ConceptoVentaLite,
  type ProformaPendienteLite,
} from "@/features/proformas/domain/proforma";

const TASA = 0.16;

function totalesAProforma(
  base: Omit<ProformaPendienteLite, "total_usd" | "total_mxn">,
  conceptos: ConceptoVentaLite[],
): ProformaPendienteLite {
  const t = calcularTotalesProforma(conceptos, TASA);
  return { ...base, total_usd: t.total_usd, total_mxn: t.total_mxn };
}

describe("B.3.2 flujo Embarque → Proforma → Factura", () => {
  it("agrupa por embarque, bucketiza contenedores y suma seleccionadas", () => {
    // Embarque A: dos proformas, una por contenedor distinto.
    const pA1 = totalesAProforma(
      {
        id: "p-a1",
        numero: "PF-001",
        expediente: "EXP-100",
        embarque_id: "emb-A",
        cliente_id: "cli-1",
        cliente_nombre: "Cliente Uno",
        operador: "Ana",
        dias_credito: 30,
        bl_master: "BL-A",
        contenedores_lista: [{ numero: "MSCU1", tipo: "40HC" }],
      },
      [
        { id: "c1", cantidad: 1, precio_unitario: 1000, moneda: "USD", aplica_iva: false },
        { id: "c2", cantidad: 2, precio_unitario: 500, moneda: "MXN" },
      ],
    );
    const pA2 = totalesAProforma(
      {
        id: "p-a2",
        numero: "PF-002",
        expediente: "EXP-100",
        embarque_id: "emb-A",
        cliente_id: "cli-1",
        cliente_nombre: "Cliente Uno",
        operador: "Ana",
        dias_credito: 30,
        bl_master: "BL-A",
        contenedores_lista: [{ numero: "MSCU2", tipo: "20DV" }],
      },
      [{ id: "c3", cantidad: 1, precio_unitario: 800, moneda: "USD", aplica_iva: true }],
    );
    // Embarque B: una proforma multi-contenedor.
    const pB1 = totalesAProforma(
      {
        id: "p-b1",
        numero: "PF-010",
        expediente: "EXP-200",
        embarque_id: "emb-B",
        cliente_id: "cli-2",
        cliente_nombre: "Cliente Dos",
        operador: "Beto",
        dias_credito: 15,
        bl_master: "BL-B",
        contenedores_lista: [
          { numero: "X1", tipo: "40HC" },
          { numero: "X2", tipo: "40HC" },
        ],
      },
      [{ id: "c4", cantidad: 1, precio_unitario: 250, moneda: "MXN" }],
    );

    const grupos = agruparProformasPendientes([pA1, pA2, pB1]);
    expect(grupos).toHaveLength(2);

    const gA = grupos.find((g) => g.embarqueId === "emb-A")!;
    expect(gA.proformas).toHaveLength(2);
    expect(gA.contenedores.map((c) => c.contenedor).sort()).toEqual(["MSCU1", "MSCU2"]);

    const gB = grupos.find((g) => g.embarqueId === "emb-B")!;
    expect(gB.contenedores).toHaveLength(1);
    expect(gB.contenedores[0].contenedor).toBe(MULTI_CONTENEDOR);

    // Totales por proforma (calculados con el helper real).
    // pA1: USD 1000 sin IVA → 1000; MXN 1000 + IVA 160 → 1160.
    expect(pA1.total_usd).toBeCloseTo(1000, 2);
    expect(pA1.total_mxn).toBeCloseTo(1160, 2);
    // pA2: USD 800 + IVA 128 → 928.
    expect(pA2.total_usd).toBeCloseTo(928, 2);

    // Selección del wizard: pA1 + pA2 (mismo embarque, mismo cliente).
    const sel = totalesProformasSeleccionadas(
      [pA1, pA2, pB1],
      new Set(["p-a1", "p-a2"]),
    );
    expect(sel.usd).toBeCloseTo(1928, 2);
    expect(sel.mxn).toBeCloseTo(1160, 2);

    // Monto principal en la lista: USD si > 0, si no MXN.
    expect(montoPrincipalProforma(pA1)).toEqual({ valor: 1000, moneda: "USD" });
    expect(montoPrincipalProforma(pB1)).toEqual({ valor: 290, moneda: "MXN" });
  });

  it("respeta tasa_iva_aplicada=0 para servicios exentos en el cálculo", () => {
    const exenta = totalesAProforma(
      {
        id: "p-x",
        numero: "PF-EX",
        expediente: "EXP-X",
        embarque_id: "emb-X",
        cliente_id: "cli-x",
        cliente_nombre: "X",
        operador: null,
        dias_credito: 0,
        bl_master: null,
        contenedores_lista: [],
      },
      [
        // MXN siempre lleva IVA salvo que tasa_iva_aplicada=0 lo declare exento.
        { id: "c1", cantidad: 1, precio_unitario: 1000, moneda: "MXN", tasa_iva_aplicada: 0 },
      ],
    );
    expect(exenta.total_mxn).toBe(1000);
    expect(exenta.total_usd).toBe(0);
    expect(montoPrincipalProforma(exenta)).toEqual({ valor: 1000, moneda: "MXN" });
  });

  it("agrupa por embarque_id aunque compartan expediente", () => {
    // Mismo expediente, embarques distintos (caso real: un embarque por contenedor).
    const base = (id: string, embId: string): ProformaPendienteLite => ({
      id,
      numero: id.toUpperCase(),
      expediente: "EXP-MISMO",
      embarque_id: embId,
      cliente_id: "cli",
      cliente_nombre: "Cli",
      operador: null,
      dias_credito: null,
      bl_master: null,
      total_usd: 0,
      total_mxn: 100,
      contenedores_lista: [{ numero: `C-${embId}`, tipo: "40HC" }],
    });
    const grupos = agruparProformasPendientes([base("p1", "e1"), base("p2", "e2")]);
    expect(grupos).toHaveLength(2);
    expect(new Set(grupos.map((g) => g.embarqueId))).toEqual(new Set(["e1", "e2"]));
  });

  it("totalesProformasSeleccionadas ignora ids no presentes", () => {
    const p = totalesAProforma(
      {
        id: "p-only",
        numero: "PF",
        expediente: "EXP",
        embarque_id: "e",
        cliente_id: "c",
        cliente_nombre: "C",
        operador: null,
        dias_credito: null,
        bl_master: null,
        contenedores_lista: [],
      },
      [{ id: "x", cantidad: 1, precio_unitario: 100, moneda: "USD", aplica_iva: false }],
    );
    const sel = totalesProformasSeleccionadas([p], new Set(["no-existe"]));
    expect(sel).toEqual({ usd: 0, mxn: 0 });
  });
});
