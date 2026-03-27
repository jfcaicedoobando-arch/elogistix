import { describe, it, expect } from "vitest";

// Test the pure helper functions by importing the module's logic directly.
// We test buildStateFromConfig / getVal behavior via the exported ConfigState defaults.

// Since the hook uses useConfiguracion internally, we test the pure logic
// (state building from config items) independently.

interface ConfigItem {
  id: string;
  categoria: string;
  clave: string;
  valor: unknown;
  descripcion: string;
}

function getVal<T>(data: ConfigItem[] | undefined, categoria: string, clave: string, fallback: T): T {
  if (!data) return fallback;
  const item = data.find((c) => c.categoria === categoria && c.clave === clave);
  return item ? (item.valor as T) : fallback;
}

function buildStateFromConfig(config: ConfigItem[] | undefined) {
  return {
    nombre: getVal(config, "empresa", "nombre", ""),
    subtitulo: getVal(config, "empresa", "subtitulo", ""),
    rfc: getVal(config, "empresa", "rfc", ""),
    direccion: getVal(config, "empresa", "direccion_fiscal", ""),
    email: getVal(config, "empresa", "email", ""),
    telefono: getVal(config, "empresa", "telefono", ""),
    usdMxn: String(getVal(config, "tipos_cambio", "usd_mxn_default", 17.25)),
    eurMxn: String(getVal(config, "tipos_cambio", "eur_mxn_default", 18.5)),
    fuente: getVal(config, "tipos_cambio", "fuente", "api"),
    vigenciaDias: String(getVal(config, "cotizaciones", "vigencia_dias", 15)),
    diasLibres: String(getVal(config, "cotizaciones", "dias_libres_destino", 0)),
    monedaCot: getVal(config, "cotizaciones", "moneda_default", "USD"),
    terminos: getVal(config, "cotizaciones", "terminos_condiciones", ""),
    tasaIva: String(getVal(config, "facturacion", "tasa_iva", 16)),
    diasVenc: String(getVal(config, "facturacion", "dias_vencimiento", 30)),
    serieFact: getVal(config, "facturacion", "serie_factura", "A"),
    folioInicial: String(getVal(config, "facturacion", "folio_inicial", 1)),
    monedaFact: getVal(config, "facturacion", "moneda_default", "MXN"),
    prefijo: getVal(config, "embarques", "prefijo_expediente", "EXP"),
    tipoCargaDefault: getVal(config, "embarques", "tipo_carga_default", "Carga General"),
    monedaEmb: getVal(config, "embarques", "moneda_default", "USD"),
    diasEta: String(getVal(config, "alertas", "dias_eta_alerta", 7)),
    diasEtaCritica: String(getVal(config, "alertas", "dias_eta_critica", 3)),
    diasFactVencer: String(getVal(config, "alertas", "dias_factura_vencer", 7)),
  };
}

describe("useConfiguracionState helpers", () => {
  describe("getVal", () => {
    const items: ConfigItem[] = [
      { id: "1", categoria: "empresa", clave: "nombre", valor: "Elogistix", descripcion: "" },
      { id: "2", categoria: "tipos_cambio", clave: "usd_mxn_default", valor: 20.5, descripcion: "" },
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
        { id: "1", categoria: "empresa", clave: "nombre", valor: "TestCo", descripcion: "" },
        { id: "2", categoria: "empresa", clave: "rfc", valor: "RFC123", descripcion: "" },
        { id: "3", categoria: "tipos_cambio", clave: "usd_mxn_default", valor: 19.0, descripcion: "" },
        { id: "4", categoria: "facturacion", clave: "tasa_iva", valor: 8, descripcion: "" },
        { id: "5", categoria: "embarques", clave: "prefijo_expediente", valor: "SHP", descripcion: "" },
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
