import { describe, expect, it } from "vitest";
import { contactoVacio, empresaVacia, payloadAlta, validarAlta } from "../altaProspecto";

const empresa = { ...empresaVacia(), nombre: "Acme", pais: "México", transporte: ["Marítimo", "Aéreo"] };

describe("alta de prospecto externo", () => {
  it("exige al menos un contacto con nombre", () => {
    expect(validarAlta(empresa, [contactoVacio()])).toBe("Agrega al menos un contacto con nombre.");
  });
  it("exige elegir transporte", () => {
    expect(validarAlta({ ...empresa, transporte: [] }, [{ ...contactoVacio(), nombre: "Ana" }]))
      .toBe("Elige al menos un tipo de transporte.");
  });
  it("une transportes, pasa RFC a mayúsculas y descarta contactos vacíos", () => {
    const p = payloadAlta({ ...empresa, rfc: "abc010101xx1" }, [{ ...contactoVacio(), nombre: " Ana " }, contactoVacio()]);
    expect(p.empresa.transporte).toBe("Marítimo, Aéreo");
    expect(p.empresa.rfc).toBe("ABC010101XX1");
    expect(p.contactos).toHaveLength(1);
    expect(p.contactos[0].nombre).toBe("Ana");
  });
});
