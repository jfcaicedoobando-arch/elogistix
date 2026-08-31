/**
 * YG-06 · el botón "Siguiente" del alta de proveedor debe decir qué falta.
 * `faltantesPaso1Proveedor` es la única fuente de verdad: si devuelve [], el
 * botón se habilita; si no, el diálogo lista los campos pendientes.
 */
import { describe, it, expect } from "vitest";
import { faltantesPaso1Proveedor } from "../useNuevoProveedorController.helpers";
import { EMPTY_PROVEEDOR_FORM, type NuevoProveedorForm } from "../useNuevoProveedorController.constants";

const base = (patch: Partial<NuevoProveedorForm> = {}): NuevoProveedorForm =>
  ({ ...EMPTY_PROVEEDOR_FORM, ...patch });

describe("faltantesPaso1Proveedor", () => {
  it("lista los campos principales cuando el formulario está vacío", () => {
    const faltan = faltantesPaso1Proveedor(base({ categoria: "" as never }), "RFC");
    expect(faltan).toContain("categoría");
    expect(faltan).toContain("nombre");
    expect(faltan).toContain("RFC");
  });

  it("usa la etiqueta Tax ID para proveedores extranjeros", () => {
    const faltan = faltantesPaso1Proveedor(
      base({ categoria: "Logistico", tipo: "Naviera", nombre: "ACME", origen_proveedor: "Extranjero" }),
      "Tax ID",
    );
    expect(faltan).toEqual(["Tax ID"]);
  });

  it("exige tipo en Logístico y país sólo en Agente de Carga", () => {
    expect(
      faltantesPaso1Proveedor(
        base({ categoria: "Logistico", nombre: "A", rfc: "AAA010101AAA", origen_proveedor: "Nacional" }),
        "RFC",
      ),
    ).toEqual(["tipo de proveedor logístico"]);

    expect(
      faltantesPaso1Proveedor(
        base({
          categoria: "Logistico", tipo: "Agente de Carga", nombre: "A",
          rfc: "AAA010101AAA", origen_proveedor: "Nacional",
        }),
        "RFC",
      ),
    ).toEqual(["país"]);
  });

  it("exige subtipo en Gasto Operativo", () => {
    expect(
      faltantesPaso1Proveedor(
        base({
          categoria: "GastoOperativo", subtipo_gasto: null, nombre: "A",
          rfc: "AAA010101AAA", origen_proveedor: "Nacional",
        }),
        "RFC",
      ),
    ).toEqual(["subtipo de gasto"]);
  });

  it("no reporta faltantes cuando el paso 1 está completo", () => {
    expect(
      faltantesPaso1Proveedor(
        base({
          categoria: "Logistico", tipo: "Naviera", nombre: "Naviera SA",
          rfc: "AAA010101AAA", origen_proveedor: "Nacional",
        }),
        "RFC",
      ),
    ).toEqual([]);
  });
});
