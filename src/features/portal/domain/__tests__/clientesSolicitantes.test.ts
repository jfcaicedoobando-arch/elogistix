/**
 * Un usuario ligado a varias empresas antes veía su solicitud atribuida al
 * primer cliente. Estas pruebas fijan el contrato de las opciones.
 */
import { describe, it, expect } from "vitest";
import { opcionesSolicitante, seleccionInicial } from "../clientesSolicitantes";

describe("opcionesSolicitante", () => {
  it("devuelve id + nombre legible y deduplica vínculos repetidos", () => {
    expect(
      opcionesSolicitante([
        { cliente_id: "cli-1", cliente_nombre: "Aceros del Norte" },
        { cliente_id: "cli-1", cliente_nombre: "Aceros del Norte" },
        { cliente_id: "cli-2", cliente_nombre: "Refacciones Bajío" },
      ]),
    ).toEqual([
      { id: "cli-1", nombre: "Aceros del Norte" },
      { id: "cli-2", nombre: "Refacciones Bajío" },
    ]);
  });

  it("sin nombre usa una etiqueta legible, nunca el UUID", () => {
    const [op] = opcionesSolicitante([{ cliente_id: "cli-9", cliente_nombre: "  " }]);
    expect(op.nombre).toBe("Empresa sin nombre");
  });

  it("ignora vínculos sin cliente", () => {
    expect(opcionesSolicitante([{ cliente_id: "", cliente_nombre: "X" }])).toEqual([]);
  });
});

describe("seleccionInicial", () => {
  it("preselecciona cuando hay exactamente una empresa", () => {
    expect(seleccionInicial([{ id: "cli-1", nombre: "A" }])).toBe("cli-1");
  });

  it("no preselecciona con varias empresas (evita atribución incorrecta)", () => {
    expect(seleccionInicial([{ id: "cli-1", nombre: "A" }, { id: "cli-2", nombre: "B" }])).toBe("");
  });

  it("sin empresas queda vacío", () => {
    expect(seleccionInicial([])).toBe("");
  });
});
