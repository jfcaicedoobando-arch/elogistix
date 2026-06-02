import { describe, it, expect } from "vitest";
import {
  agruparProformasPendientes,
  montoPrincipalProforma,
  totalesProformasSeleccionadas,
  MULTI_CONTENEDOR,
} from "../proformaAgrupacion";
import type { ProformaPendienteLite } from "../proformaAgrupacion";

const mkP = (
  id: string,
  expediente: string,
  contenedores_lista?: ProformaPendienteLite["contenedores_lista"],
  embarqueId?: string,
): ProformaPendienteLite => ({
  id,
  numero: `PRO-${id}`,
  expediente,
  embarque_id: embarqueId ?? `emb-${expediente}`,
  cliente_id: "cli1",
  cliente_nombre: "ACME",
  operador: null,
  dias_credito: 30,
  bl_master: null,
  total_usd: 100,
  total_mxn: 0,
  contenedores_lista,
});


// ─── agruparProformasPendientes ───────────────────────────────────────────

describe("agruparProformasPendientes (agrupacion)", () => {
  it("happy path: groups by expediente then by container", () => {
    const ps = [
      mkP("p1", "EXP-01", [{ numero: "CONT001", tipo: "20GP" }]),
      mkP("p2", "EXP-01", [{ numero: "CONT001", tipo: "20GP" }]),
      mkP("p3", "EXP-02", [{ numero: "CONT002", tipo: "40HC" }]),
    ];
    const grupos = agruparProformasPendientes(ps);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].expediente).toBe("EXP-01");
    expect(grupos[0].proformas).toHaveLength(2);
    expect(grupos[0].contenedores[0].contenedor).toBe("CONT001");
  });

  it("empty input returns empty array", () => {
    expect(agruparProformasPendientes([])).toEqual([]);
  });

  it("proforma with 2 distinct containers uses MULTI_CONTENEDOR sentinel", () => {
    const ps = [
      mkP("p1", "EXP-01", [
        { numero: "CONT001", tipo: "20GP" },
        { numero: "CONT002", tipo: "40HC" },
      ]),
    ];
    const grupos = agruparProformasPendientes(ps);
    expect(grupos[0].contenedores[0].contenedor).toBe(MULTI_CONTENEDOR);
  });

  it("proforma with null contenedores_lista falls back to legacy embarques.contenedor", () => {
    const p: ProformaPendienteLite = {
      ...mkP("p1", "EXP-01"),
      contenedores_lista: [],
      embarques: { contenedor: "LEGACY001", tipo_contenedor: "20GP" },
    };
    const grupos = agruparProformasPendientes([p]);
    expect(grupos[0].contenedores[0].contenedor).toBe("LEGACY001");
  });

  it("groups are sorted alphabetically by expediente", () => {
    const ps = [mkP("p1", "EXP-ZZ"), mkP("p2", "EXP-AA")];
    const grupos = agruparProformasPendientes(ps);
    expect(grupos[0].expediente).toBe("EXP-AA");
  });

  it("mismo expediente con embarques distintos genera grupos separados", () => {
    const ps = [
      mkP("p1", "EXP-01", undefined, "emb-A"),
      mkP("p2", "EXP-01", undefined, "emb-B"),
    ];
    const grupos = agruparProformasPendientes(ps);
    expect(grupos).toHaveLength(2);
    expect(grupos.every((g) => g.expediente === "EXP-01")).toBe(true);
    expect(new Set(grupos.map((g) => g.embarqueId))).toEqual(new Set(["emb-A", "emb-B"]));
  });

  it("mismo expediente y mismo embarque permanece como un solo grupo", () => {
    const ps = [
      mkP("p1", "EXP-01", undefined, "emb-A"),
      mkP("p2", "EXP-01", undefined, "emb-A"),
    ];
    const grupos = agruparProformasPendientes(ps);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].proformas).toHaveLength(2);
  });
});


// ─── montoPrincipalProforma ───────────────────────────────────────────────

describe("montoPrincipalProforma (agrupacion)", () => {
  it("returns USD when usd > 0", () => {
    expect(montoPrincipalProforma({ total_usd: 500, total_mxn: 8500 })).toEqual({ valor: 500, moneda: "USD" });
  });

  it("falls back to MXN when usd is 0", () => {
    expect(montoPrincipalProforma({ total_usd: 0, total_mxn: 3000 })).toEqual({ valor: 3000, moneda: "MXN" });
  });

  it("handles null values as 0", () => {
    expect(montoPrincipalProforma({ total_usd: null, total_mxn: null })).toEqual({ valor: 0, moneda: "MXN" });
  });
});

// ─── totalesProformasSeleccionadas ────────────────────────────────────────

describe("totalesProformasSeleccionadas (agrupacion)", () => {
  const ps = [
    { ...mkP("p1", "E1"), total_usd: 100, total_mxn: 1700 },
    { ...mkP("p2", "E1"), total_usd: 50,  total_mxn: 850 },
    { ...mkP("p3", "E1"), total_usd: 200, total_mxn: 3400 },
  ];

  it("sums only selected ids", () => {
    const result = totalesProformasSeleccionadas(ps, new Set(["p1", "p3"]));
    expect(result.usd).toBe(300);
    expect(result.mxn).toBe(5100);
  });

  it("returns zeros when no ids selected", () => {
    expect(totalesProformasSeleccionadas(ps, new Set())).toEqual({ usd: 0, mxn: 0 });
  });
});
