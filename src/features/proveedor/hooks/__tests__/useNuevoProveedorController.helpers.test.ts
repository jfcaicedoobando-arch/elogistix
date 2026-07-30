/**
 * R-03 — El payload de alta de proveedor debe limitarse a las columnas reales
 * de la tabla y validar la coherencia categoría ↔ tipo/subtipo antes de enviar.
 */
import { describe, it, expect } from "vitest";
import { preparePayload } from "../useNuevoProveedorController.helpers";
import { EMPTY_PROVEEDOR_FORM, type NuevoProveedorForm } from "../useNuevoProveedorController.constants";

function form(overrides: Partial<NuevoProveedorForm> = {}): NuevoProveedorForm {
  return {
    ...EMPTY_PROVEEDOR_FORM,
    nombre: "Naviera Demo",
    categoria: "Logistico",
    tipo: "Naviera",
    origen_proveedor: "Nacional",
    ...overrides,
  };
}

describe("preparePayload (R-03)", () => {
  it("descarta campos que no son columnas de la tabla", () => {
    const conBasura = { ...form(), campo_inventado: "x" } as unknown as NuevoProveedorForm;
    const r = preparePayload(conBasura);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload).not.toHaveProperty("campo_inventado");
    expect(r.payload.nombre).toBe("Naviera Demo");
    expect(r.payload.tipo).toBe("Naviera");
    expect(r.payload.origen_proveedor).toBe("Nacional");
  });

  it("exige tipo cuando la categoría es Logistico", () => {
    const r = preparePayload(form({ tipo: null }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("tipo");
  });

  it("exige subtipo cuando la categoría es GastoOperativo y anula el tipo", () => {
    const sinSubtipo = preparePayload(form({ categoria: "GastoOperativo", subtipo_gasto: null }));
    expect(sinSubtipo.ok).toBe(false);

    const ok = preparePayload(form({ categoria: "GastoOperativo", subtipo_gasto: "Renta" }));
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.payload.tipo).toBeNull();
    expect(ok.payload.subtipo_gasto).toBe("Renta");
  });

  it("un proveedor extranjero no envía CLABE", () => {
    const r = preparePayload(
      form({ origen_proveedor: "Extranjero", clabe: "012345678901234567", swift_bic: "BCMRMXMM" }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.clabe).toBe("");
    expect(r.payload.swift_bic).toBe("BCMRMXMM");
  });
});
