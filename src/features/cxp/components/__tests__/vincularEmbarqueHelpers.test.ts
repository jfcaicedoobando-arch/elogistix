import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => {
  const info = vi.fn();
  const success = vi.fn();
  const error = vi.fn();
  const toast = Object.assign(vi.fn((...args: unknown[]) => info(...args)), { info, success, error });
  return { toast };
});

import { toast } from "sonner";
import {
  agruparPorEmbarque,
  pluralS,
  notificarResumen,
  calcularPuedeSugerir,
  ejecutarSugerencia,
  filtrarGrupos,
  type Grupo,
} from "../vincularEmbarqueHelpers";

// SAFE-CAST: fixture helper para tests.
const concepto = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    id: "cid",
    concepto: "Flete marítimo",
    monto: 100,
    moneda: "USD",
    embarque_id: "e1",
    embarque_expediente: "EXP-001",
    ...over,
  }) as never;

describe("vincularEmbarqueHelpers", () => {
  beforeEach(() => {
    (toast.info as ReturnType<typeof vi.fn>).mockClear();
    (toast.success as ReturnType<typeof vi.fn>).mockClear();
  });

  describe("pluralS", () => {
    it("singular sin s", () => {
      expect(pluralS(1, "sugerencia")).toBe("1 sugerencia");
    });
    it("plural con s", () => {
      expect(pluralS(3, "sugerencia")).toBe("3 sugerencias");
    });
    it("cero pluraliza", () => {
      expect(pluralS(0, "match")).toBe("0 matchs");
    });
  });

  describe("agruparPorEmbarque", () => {
    it("agrupa items por embarque_id", () => {
      const grupos: Grupo[] = agruparPorEmbarque([
        concepto({ id: "a", embarque_id: "e1" }),
        concepto({ id: "b", embarque_id: "e1" }),
        concepto({ id: "c", embarque_id: "e2", embarque_expediente: "EXP-002" }),
      ]);
      expect(grupos).toHaveLength(2);
      const g1 = grupos.find((g) => g.embarqueId === "e1")!;
      expect(g1.items).toHaveLength(2);
      expect(g1.expediente).toBe("EXP-001");
    });

    it("usa slice(0,8) del id cuando no hay expediente", () => {
      const g = agruparPorEmbarque([
        concepto({ embarque_id: "abcdef1234", embarque_expediente: null }),
      ]);
      expect(g[0].expediente).toBe("abcdef12");
    });

    it("array vacío → resultado vacío", () => {
      expect(agruparPorEmbarque([])).toEqual([]);
    });

    it("ordena grupos por expediente ascendente (natural sort)", () => {
      const grupos = agruparPorEmbarque([
        concepto({ id: "x", embarque_id: "e10", embarque_expediente: "EXP-010" }),
        concepto({ id: "y", embarque_id: "e2", embarque_expediente: "EXP-002" }),
        concepto({ id: "z", embarque_id: "e1", embarque_expediente: "EXP-001" }),
      ]);
      expect(grupos.map((g) => g.expediente)).toEqual(["EXP-001", "EXP-002", "EXP-010"]);
    });
  });

  describe("calcularPuedeSugerir", () => {
    const base = {
      onAplicar: () => {},
      descripcion: "Flete",
      monto: 100,
      moneda: "USD",
      totalCandidatos: 3,
    };
    it("true con todos los campos", () => {
      expect(calcularPuedeSugerir(base)).toBe(true);
    });
    it("false sin onAplicar", () => {
      expect(calcularPuedeSugerir({ ...base, onAplicar: null })).toBe(false);
    });
    it("false sin descripcion", () => {
      expect(calcularPuedeSugerir({ ...base, descripcion: "" })).toBe(false);
    });
    it("false con monto 0", () => {
      expect(calcularPuedeSugerir({ ...base, monto: 0 })).toBe(false);
    });
    it("false sin moneda", () => {
      expect(calcularPuedeSugerir({ ...base, moneda: "" })).toBe(false);
    });
    it("false sin candidatos", () => {
      expect(calcularPuedeSugerir({ ...base, totalCandidatos: 0 })).toBe(false);
    });
  });

  describe("notificarResumen", () => {
    it("info cuando no hay selección", () => {
      notificarResumen({ seleccion: [], descartadosPorMoneda: 0 }, 5);
      expect(toast.info).toHaveBeenCalledOnce();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("success con partes combinadas (fuerte + dudosa + descarte + sin match)", () => {
      notificarResumen(
        {
          seleccion: [
            { fuerte: true } as never,
            { fuerte: false } as never,
          ],
          descartadosPorMoneda: 1,
        },
        5,
      );
      const call = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(call).toContain("2 sugerencias");
      expect(call).toContain("1 dudosa");
      expect(call).toContain("1 descartada");
      expect(call).toContain("2 sin match");
    });

    it("success sin partes extra cuando todo es fuerte", () => {
      notificarResumen(
        { seleccion: [{ fuerte: true } as never], descartadosPorMoneda: 0 },
        1,
      );
      const call = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(call).toBe("1 sugerencia aplicada");
    });
  });

  describe("ejecutarSugerencia", () => {
    it("aplica sugerencias y notifica", () => {
      const onAplicar = vi.fn();
      const setUltima = vi.fn();
      ejecutarSugerencia({
        data: [
          concepto({ id: "c1", concepto: "Flete marítimo USD", monto: 100, moneda: "USD" }),
          concepto({ id: "c2", concepto: "Otro concepto", monto: 999, moneda: "USD" }),
        ],
        descripcion: "Flete marítimo",
        monto: 100,
        moneda: "USD",
        onAplicar,
        setUltima,
      });
      expect(setUltima).toHaveBeenCalled();
      expect(onAplicar).toHaveBeenCalled();
    });

    it("con data vacía notifica info", () => {
      const onAplicar = vi.fn();
      const setUltima = vi.fn();
      ejecutarSugerencia({
        data: [],
        descripcion: "X",
        monto: 100,
        moneda: "USD",
        onAplicar,
        setUltima,
      });
      expect(setUltima).toHaveBeenCalledWith([]);
      expect(toast.info).toHaveBeenCalled();
    });
  });

  describe("filtrarGrupos", () => {
    const buildGrupos = (): Grupo[] => [
      {
        embarqueId: "e1",
        expediente: "EXP-001",
        items: [
          concepto({ id: "a", concepto: "Flete marítimo", monto: 100 }),
          concepto({ id: "b", concepto: "Maniobras puerto", monto: 250 }),
        ],
      },
      {
        embarqueId: "e2",
        expediente: "EXP-002",
        items: [concepto({ id: "c", concepto: "Demoras", monto: 999 })],
      },
    ];

    it("sin filtro devuelve todo", () => {
      const r = filtrarGrupos(buildGrupos(), { texto: "", soloMarcados: false, seleccion: {} });
      expect(r).toHaveLength(2);
      expect(r[0].items).toHaveLength(2);
    });

    it("filtra por texto en concepto (case-insensitive)", () => {
      const r = filtrarGrupos(buildGrupos(), { texto: "flete", soloMarcados: false, seleccion: {} });
      expect(r).toHaveLength(1);
      expect(r[0].items).toHaveLength(1);
      expect(r[0].items[0].id).toBe("a");
    });

    it("filtra por expediente y omite grupos sin matches", () => {
      const r = filtrarGrupos(buildGrupos(), { texto: "exp-002", soloMarcados: false, seleccion: {} });
      expect(r).toHaveLength(1);
      expect(r[0].embarqueId).toBe("e2");
    });

    it("filtra por monto como string", () => {
      const r = filtrarGrupos(buildGrupos(), { texto: "250", soloMarcados: false, seleccion: {} });
      expect(r).toHaveLength(1);
      expect(r[0].items[0].id).toBe("b");
    });

    it("soloMarcados deja solo los seleccionados", () => {
      const r = filtrarGrupos(buildGrupos(), {
        texto: "",
        soloMarcados: true,
        seleccion: { a: { monto: 100 }, c: { monto: 999 } },
      });
      expect(r).toHaveLength(2);
      expect(r[0].items.map((i) => i.id)).toEqual(["a"]);
      expect(r[1].items.map((i) => i.id)).toEqual(["c"]);
    });
  });
});

