import { describe, it, expect } from "vitest";
import { getVal, buildStateFromConfig } from "@/hooks/configuracion/useConfiguracionState";
import type { ConfigItem } from "@/hooks/configuracion/useConfiguracion";

const item = (id: string, categoria: string, clave: string, valor: unknown): ConfigItem => ({
  id, categoria, clave, valor, descripcion: "",
});

describe("useConfiguracionState helpers", () => {
  describe("getVal", () => {
    const items: ConfigItem[] = [
      item("1", "empresa", "nombre", "Elogistix"),
      item("2", "tipos_cambio", "usd_mxn_default", 20.5),
    ];

    it("returns matching value", () => {
      expect(getVal(items, "empresa", "nombre", "")).toBe("Elogistix");
    });

    it("returns numeric value", () => {
      expect(getVal(items, "tipos_cambio", "usd_mxn_default", 17.25)).toBe(20.5);
    });

    it("returns fallback when key not found", () => {
      expect(getVal(items, "empresa", "no_existe", "default")).toBe("default");
    });

    it("returns fallback when data is undefined", () => {
      expect(getVal(undefined, "empresa", "nombre", "fallback")).toBe("fallback");
    });
  });

  describe("buildStateFromConfig", () => {
    it("returns defaults when config is undefined", () => {
      const state = buildStateFromConfig(undefined);
      expect(state.nombre).toBe("");
      expect(state.usdMxn).toBe("17.25");
      expect(state.eurMxn).toBe("18.5");
      expect(state.vigenciaDias).toBe("15");
      expect(state.tasaIva).toBe("16");
      expect(state.prefijo).toBe("EXP");
      expect(state.monedaCot).toBe("USD");
      expect(state.monedaFact).toBe("MXN");
    });

    it("builds state from config items", () => {
      const config: ConfigItem[] = [
        item("1", "empresa", "nombre", "TestCo"),
        item("2", "empresa", "rfc", "RFC123"),
        item("3", "tipos_cambio", "usd_mxn_default", 19.0),
        item("4", "facturacion", "tasa_iva", 8),
        item("5", "embarques", "prefijo_expediente", "SHP"),
      ];
      const state = buildStateFromConfig(config);
      expect(state.nombre).toBe("TestCo");
      expect(state.rfc).toBe("RFC123");
      expect(state.usdMxn).toBe("19");
      expect(state.tasaIva).toBe("8");
      expect(state.prefijo).toBe("SHP");
      expect(state.eurMxn).toBe("18.5");
      expect(state.monedaCot).toBe("USD");
    });
  });
});
