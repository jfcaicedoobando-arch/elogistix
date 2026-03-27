import { describe, it, expect } from "vitest";
import { getVal, buildStateFromConfig } from "@/hooks/useConfiguracionState";
import type { ConfigItem } from "@/hooks/useConfiguracion";

describe("useConfiguracionState helpers", () => {
  describe("getVal", () => {
    const items: ConfigItem[] = [
      { id: "1", categoria: "empresa", clave: "nombre", valor: "Elogistix", descripcion: "", organization_id: "", created_at: "", updated_at: "" },
      { id: "2", categoria: "tipos_cambio", clave: "usd_mxn_default", valor: 20.5, descripcion: "", organization_id: "", created_at: "", updated_at: "" },
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
        { id: "1", categoria: "empresa", clave: "nombre", valor: "TestCo", descripcion: "", organization_id: "", created_at: "", updated_at: "" },
        { id: "2", categoria: "empresa", clave: "rfc", valor: "RFC123", descripcion: "", organization_id: "", created_at: "", updated_at: "" },
        { id: "3", categoria: "tipos_cambio", clave: "usd_mxn_default", valor: 19.0, descripcion: "", organization_id: "", created_at: "", updated_at: "" },
        { id: "4", categoria: "facturacion", clave: "tasa_iva", valor: 8, descripcion: "", organization_id: "", created_at: "", updated_at: "" },
        { id: "5", categoria: "embarques", clave: "prefijo_expediente", valor: "SHP", descripcion: "", organization_id: "", created_at: "", updated_at: "" },
      ];
      const state = buildStateFromConfig(config);
      expect(state.nombre).toBe("TestCo");
      expect(state.rfc).toBe("RFC123");
      expect(state.usdMxn).toBe("19");
      expect(state.tasaIva).toBe("8");
      expect(state.prefijo).toBe("SHP");
      // Defaults for missing keys
      expect(state.eurMxn).toBe("18.5");
      expect(state.monedaCot).toBe("USD");
    });
  });
});
