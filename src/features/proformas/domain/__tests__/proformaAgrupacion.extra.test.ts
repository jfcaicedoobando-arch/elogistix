import { describe, it, expect } from "vitest";
import {
  agruparProformasPendientes,
  montoPrincipalProforma,
  totalesProformasSeleccionadas,
  MULTI_CONTENEDOR,
  type ProformaPendienteLite,
} from "@/features/proformas/domain/proformaAgrupacion";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const base = (overrides: Partial<ProformaPendienteLite> = {}): ProformaPendienteLite => ({
  id: "p1",
  numero: "PRO-001",
  expediente: "EXP-001",
  embarque_id: "emb-1",
  cliente_id: "cli-1",
  cliente_nombre: "Cliente A",
  operador: null,
  dias_credito: null,
  bl_master: null,
  total_usd: 0,
  total_mxn: 0,
  ...overrides,
});

describe("proformaAgrupacion.extra", () => {
  // ── montoPrincipalProforma ──────────────────────────────────────────────────
  it("montoPrincipalProforma: retorna USD cuando usd > 0", () => {
    const r = montoPrincipalProforma({ total_usd: 500, total_mxn: 8000 });
    expect(r).toEqual({ valor: 500, moneda: "USD" });
  });

  it("montoPrincipalProforma: retorna MXN cuando usd = 0", () => {
    const r = montoPrincipalProforma({ total_usd: 0, total_mxn: 8000 });
    expect(r).toEqual({ valor: 8000, moneda: "MXN" });
  });

  it("montoPrincipalProforma: acepta valores string", () => {
    const r = montoPrincipalProforma({ total_usd: "200.50", total_mxn: "3000" });
    expect(r.moneda).toBe("USD");
    expect(r.valor).toBeCloseTo(200.5);
  });

  it("montoPrincipalProforma: null se trata como 0", () => {
    const r = montoPrincipalProforma({ total_usd: null, total_mxn: null });
    expect(r).toEqual({ valor: 0, moneda: "MXN" });
  });

  // ── totalesProformasSeleccionadas ──────────────────────────────────────────
  it("totalesProformasSeleccionadas: suma solo los seleccionados", () => {
    const proformas = [
      base({ id: "p1", total_usd: 100, total_mxn: 0 }),
      base({ id: "p2", total_usd: 200, total_mxn: 0 }),
      base({ id: "p3", total_usd: 50,  total_mxn: 500 }),
    ];
    const result = totalesProformasSeleccionadas(proformas, new Set(["p1", "p3"]));
    expect(result.usd).toBe(150);
    expect(result.mxn).toBe(500);
  });

  it("totalesProformasSeleccionadas: conjunto vacío retorna ceros", () => {
    const proformas = [base({ id: "p1", total_usd: 100, total_mxn: 200 })];
    const result = totalesProformasSeleccionadas(proformas, new Set());
    expect(result).toEqual({ usd: 0, mxn: 0 });
  });

  // ── agruparProformasPendientes ─────────────────────────────────────────────
  it("agruparProformasPendientes: agrupa por embarque_id", () => {
    const proformas = [
      base({ id: "p1", embarque_id: "emb-1", expediente: "EXP-A" }),
      base({ id: "p2", embarque_id: "emb-1", expediente: "EXP-A" }),
      base({ id: "p3", embarque_id: "emb-2", expediente: "EXP-B" }),
    ];
    const grupos = agruparProformasPendientes(proformas);
    expect(grupos).toHaveLength(2);
    const g1 = grupos.find((g) => g.embarqueId === "emb-1")!;
    expect(g1.proformas).toHaveLength(2);
  });

  it("agruparProformasPendientes: ordena alfabéticamente por expediente", () => {
    const proformas = [
      base({ id: "p2", embarque_id: "emb-2", expediente: "EXP-Z" }),
      base({ id: "p1", embarque_id: "emb-1", expediente: "EXP-A" }),
    ];
    const grupos = agruparProformasPendientes(proformas);
    expect(grupos[0].expediente).toBe("EXP-A");
    expect(grupos[1].expediente).toBe("EXP-Z");
  });

  it("agruparProformasPendientes: contenedor único desde contenedores_lista", () => {
    const p = base({
      contenedores_lista: [{ numero: "CTN-001", tipo: "40HC" }],
      embarques: { bl_master: null, contenedor: "OLD-CTN", tipo_contenedor: "20GP" },
    });
    const [grupo] = agruparProformasPendientes([p]);
    expect(grupo.contenedores[0].contenedor).toBe("CTN-001");
    expect(grupo.contenedores[0].tipo_contenedor).toBe("40HC");
  });

  it("agruparProformasPendientes: múltiples contenedores produce MULTI_CONTENEDOR", () => {
    const p = base({
      contenedores_lista: [
        { numero: "CTN-001", tipo: "40HC" },
        { numero: "CTN-002", tipo: "20GP" },
      ],
    });
    const [grupo] = agruparProformasPendientes([p]);
    expect(grupo.contenedores[0].contenedor).toBe(MULTI_CONTENEDOR);
  });

  it("agruparProformasPendientes: sin contenedores_lista usa fallback legacy", () => {
    const p = base({
      contenedores_lista: [],
      embarques: { bl_master: null, contenedor: "LEGACY-001", tipo_contenedor: "20GP" },
    });
    const [grupo] = agruparProformasPendientes([p]);
    expect(grupo.contenedores[0].contenedor).toBe("LEGACY-001");
  });

  it("agruparProformasPendientes: embarque_id null usa fallback por expediente", () => {
    const p = base({ id: "p1", embarque_id: null, expediente: "EXP-NULL" });
    const grupos = agruparProformasPendientes([p]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].expediente).toBe("EXP-NULL");
  });

  it("agruparProformasPendientes: lista vacía retorna array vacío", () => {
    expect(agruparProformasPendientes([])).toEqual([]);
  });
});
