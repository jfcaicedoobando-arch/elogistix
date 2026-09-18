/**
 * P2-IVA — etiquetas de tasa separadas por tratamiento y protección del 8%.
 */
import { describe, it, expect } from "vitest";
import { TASAS_IVA_MX } from "@/lib/financial/financialUtils";
import { esTasaFrontera, tasaSeleccionable, CONFIG_IVA_FRONTERA } from "@/lib/financial/ivaFrontera";
import { TIPO_IVA_AYUDA, TIPO_IVA_LABEL_SAT, TIPO_IVA_OPCIONES } from "@/lib/financial/tipoIvaSat";

describe("etiquetas del selector de tasas", () => {
  it("la opción 0% ya no dice 'Exento'", () => {
    const cero = TASAS_IVA_MX.find((t) => t.value === 0);
    expect(cero?.label).toBe("0% — Tasa 0%");
    expect(cero?.label.toLowerCase()).not.toContain("exento");
  });

  it("el selector de tasas no ofrece exento ni no objeto", () => {
    const labels = TASAS_IVA_MX.map((t) => t.label.toLowerCase()).join(" ");
    expect(labels).not.toContain("exento");
    expect(labels).not.toContain("no objeto");
    expect(TASAS_IVA_MX.map((t) => t.value)).toEqual([0, 0.08, 0.16]);
  });

  it("los tratamientos siguen siendo cinco opciones distintas con ayuda propia", () => {
    expect(TIPO_IVA_OPCIONES).toHaveLength(5);
    expect(TIPO_IVA_LABEL_SAT.tasa_0).not.toBe(TIPO_IVA_LABEL_SAT.exento);
    const ayudas = Object.values(TIPO_IVA_AYUDA);
    expect(new Set(ayudas).size).toBe(ayudas.length);
    expect(TIPO_IVA_AYUDA.no_objeto).toContain("No es exento ni tasa 0%");
  });
});

describe("tasa 8% de región fronteriza", () => {
  it("identifica la tasa del estímulo", () => {
    expect(esTasaFrontera(0.08)).toBe(true);
    expect(esTasaFrontera(0.16)).toBe(false);
    expect(esTasaFrontera(0)).toBe(false);
  });

  it("por defecto no es seleccionable y sólo se habilita explícitamente", () => {
    expect(tasaSeleccionable(0.08, false)).toBe(false);
    expect(tasaSeleccionable(0.08, true)).toBe(true);
    // Las demás tasas nunca se bloquean.
    expect(tasaSeleccionable(0, false)).toBe(true);
    expect(tasaSeleccionable(0.16, false)).toBe(true);
  });

  it("la configuración vive por organización en facturación", () => {
    expect(CONFIG_IVA_FRONTERA).toEqual({
      categoria: "facturacion",
      clave: "iva_frontera_habilitado",
    });
  });
});
