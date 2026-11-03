import { describe, it, expect } from "vitest";
import { toEmbarqueBloqueadoError, EmbarqueBloqueadoError } from "../embarqueBloqueadoError";
import { diagnosticoBaja, EMBARQUE_ID, OTRO_EMBARQUE_ID, FACTURA_ID } from "./fixtures/diagnosticoBaja.fixture";

const motivosValidos = {
  facturas: 2,
  cxp: 1,
  pagos_cxc: 0,
  pagos_cxp: 0,
  notas_credito_cxc: 0,
  notas_credito_cxp: 0,
  comisiones_definitivas: 0,
  proformas: 0,
  cerrado: true,
  expediente: "EXP-001",
};

describe("EmbarqueBloqueadoError", () => {
  it("construye el mensaje con el expediente", () => {
    const err = new EmbarqueBloqueadoError(motivosValidos);
    expect(err.name).toBe("EmbarqueBloqueadoError");
    expect(err.message).toContain("EXP-001");
    expect(err.motivos).toEqual(motivosValidos);
  });
});

describe("toEmbarqueBloqueadoError", () => {
  it("devuelve null si el error no es un objeto", () => {
    expect(toEmbarqueBloqueadoError("string error")).toBeNull();
    expect(toEmbarqueBloqueadoError(null)).toBeNull();
    expect(toEmbarqueBloqueadoError(undefined)).toBeNull();
    expect(toEmbarqueBloqueadoError(42)).toBeNull();
  });

  it("devuelve null si el objeto no tiene message ni hint", () => {
    expect(toEmbarqueBloqueadoError({})).toBeNull();
  });

  it("devuelve null si message no contiene el marcador", () => {
    expect(toEmbarqueBloqueadoError({ message: "otro error", hint: "" })).toBeNull();
  });

  it("devuelve null si message no es string", () => {
    expect(toEmbarqueBloqueadoError({ message: 123, hint: JSON.stringify(motivosValidos) })).toBeNull();
  });

  it("devuelve null si hint no es string", () => {
    const err = { message: "LC_EMBARQUE_BLOQUEADO: bloqueado", hint: 123 };
    expect(toEmbarqueBloqueadoError(err)).toBeNull();
  });

  it("devuelve null si el hint no es JSON válido", () => {
    const err = { message: "LC_EMBARQUE_BLOQUEADO: bloqueado", hint: "no-json{" };
    expect(toEmbarqueBloqueadoError(err)).toBeNull();
  });

  it("devuelve null si el hint es un JSON que no es objeto", () => {
    const err = { message: "LC_EMBARQUE_BLOQUEADO: bloqueado", hint: JSON.stringify("solo un string") };
    expect(toEmbarqueBloqueadoError(err)).toBeNull();
  });

  it("devuelve null si el hint es null tras parsear", () => {
    const err = { message: "LC_EMBARQUE_BLOQUEADO: bloqueado", hint: "null" };
    expect(toEmbarqueBloqueadoError(err)).toBeNull();
  });

  it("devuelve null si falta expediente como string", () => {
    const err = { message: "LC_EMBARQUE_BLOQUEADO: bloqueado", hint: JSON.stringify({ facturas: 1 }) };
    expect(toEmbarqueBloqueadoError(err)).toBeNull();
  });

  it("construye la excepción tipada con valores numéricos por default cuando faltan campos", () => {
    const hint = JSON.stringify({ expediente: "EXP-002" });
    const err = { message: "LC_EMBARQUE_BLOQUEADO: bloqueado", hint };
    const result = toEmbarqueBloqueadoError(err);
    expect(result).toBeInstanceOf(EmbarqueBloqueadoError);
    expect(result?.motivos.expediente).toBe("EXP-002");
    expect(result?.motivos.facturas).toBe(0);
    expect(result?.motivos.cerrado).toBe(false);
  });

  it("construye la excepción tipada con todos los campos completos", () => {
    const err = { message: "LC_EMBARQUE_BLOQUEADO: el embarque tiene dependencias", hint: JSON.stringify(motivosValidos) };
    const result = toEmbarqueBloqueadoError(err);
    expect(result?.motivos).toEqual(motivosValidos);
  });

  it("rechaza valores no numéricos sin inventar conteos cero", () => {
    const hint = JSON.stringify({ expediente: "EXP-003", facturas: "abc", cxp: "no-num" });
    const err = { message: "LC_EMBARQUE_BLOQUEADO", hint };
    const result = toEmbarqueBloqueadoError(err);
    expect(result).toBeNull();
  });

  it("conserva el HINT v1 con cierre, comisiones y ejemplos", () => {
    const hint = diagnosticoBaja({ bloqueado: true, facturas: 2, cerrado: true, comisiones_definitivas: 1,
      ejemplos_cxc: [{ id: FACTURA_ID, folio: "F-FICTICIA", estado: "Emitida" }] });
    const result = toEmbarqueBloqueadoError({ message: "LC_EMBARQUE_BLOQUEADO", hint: JSON.stringify(hint) }, EMBARQUE_ID);
    expect(result?.motivos).toEqual(hint);
  });

  it.each([
    diagnosticoBaja({ bloqueado: true, cerrado: true, version: 2 as never }),
    diagnosticoBaja({ embarque_id: OTRO_EMBARQUE_ID, bloqueado: true, cerrado: true }),
    diagnosticoBaja(),
  ])("no interpreta un HINT incompatible, de otro embarque o incoherente %#", (hint) => {
    expect(toEmbarqueBloqueadoError({ message: "LC_EMBARQUE_BLOQUEADO", hint: JSON.stringify(hint) }, EMBARQUE_ID)).toBeNull();
  });

});
