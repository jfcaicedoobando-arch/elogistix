/**
 * R219-UI-02 — El valor guardado (UUID de catálogo) debe seguir visible en los
 * selectores de tipo de contenedor, con nombre legible y sin mostrar el UUID.
 */
import { describe, it, expect } from "vitest";
import { opcionTipoGuardada } from "../opcionTipoContenedor";

const UUID = "a54f64b3-fb27-4cb9-b69f-31bc9076b390";
const catalogo = [{ id: UUID, code: "20DRY", name: "20' Dry (Standard)" }];

describe("opcionTipoGuardada", () => {
  it("inyecta la opción del UUID heredado con su nombre de catálogo", () => {
    expect(opcionTipoGuardada(UUID, catalogo, ["20DRY", "40HC"])).toEqual({
      value: UUID,
      label: "20' Dry (Standard)",
    });
  });

  it("no inyecta nada cuando el valor ya está entre las opciones", () => {
    expect(opcionTipoGuardada("20DRY", catalogo, ["20DRY"])).toBeNull();
    expect(opcionTipoGuardada("", catalogo, ["20DRY"])).toBeNull();
    expect(opcionTipoGuardada(null, catalogo, ["20DRY"])).toBeNull();
  });

  it("catálogo tardío/inactivo preserva el valor sin exponer el UUID", () => {
    const opcion = opcionTipoGuardada(UUID, [], ["20DRY"]);
    expect(opcion?.value).toBe(UUID);
    expect(opcion?.label).not.toContain(UUID);
    expect(opcion?.label).toBe("Valor guardado (cargando catálogo…)");
  });

  it("valor legacy no listado se conserva mostrando su texto", () => {
    expect(opcionTipoGuardada("20' GP", catalogo, ["20DRY"])).toEqual({
      value: "20' GP",
      label: "Valor guardado (cargando catálogo…)",
    });
  });
});
