import { describe, it, expect } from "vitest";
import { getVal, buildStateFromConfig } from "@/features/configuracion/hooks/useConfiguracionState";
import type { ConfigItem } from "@/features/configuracion/hooks/useConfiguracion";

const item = (id: string, categoria: string, clave: string, valor: unknown): ConfigItem => ({
  id, categoria, clave, valor, descripcion: "",
});

describe("useConfiguracionState helpers", () => {
  describe("getVal", () => {
    const items: ConfigItem[] = [
      item("1", "empresa", "nombre", "Elogistix"),
      item("2", "facturacion", "tasa_iva", 16),
    ];

    it("returns matching value", () => {
      expect(getVal(items, "empresa", "nombre", "")).toBe("Elogistix");
    });

    it("returns numeric value", () => {
      expect(getVal(items, "facturacion", "tasa_iva", 0)).toBe(16);
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
      expect(state.rfc).toBe("");
    });

    it("builds state from config items", () => {
      const config: ConfigItem[] = [
        item("1", "empresa", "nombre", "TestCo"),
        item("2", "empresa", "rfc", "RFC123"),
      ];
      const state = buildStateFromConfig(config);
      expect(state.nombre).toBe("TestCo");
      expect(state.rfc).toBe("RFC123");
    });
  });
});
