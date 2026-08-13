import { describe, it, expect } from "vitest";
import {
  CONTACTO_PROVEEDOR_VACIO,
  contactoAForm,
  contactoPrincipal,
  ordenarContactos,
  validarContactoProveedor,
  type ContactoProveedor,
} from "../contactosProveedor";

function contacto(over: Partial<ContactoProveedor>): ContactoProveedor {
  return {
    id: over.id ?? "1",
    proveedor_id: "p1",
    nombre: over.nombre ?? "Ana López",
    puesto: over.puesto ?? "",
    area: over.area ?? "",
    email: over.email ?? "",
    telefono: over.telefono ?? "",
    extension: over.extension ?? "",
    es_principal: over.es_principal ?? false,
    notas: over.notas ?? null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("contactosProveedor — validación", () => {
  it("exige nombre completo", () => {
    expect(validarContactoProveedor({ ...CONTACTO_PROVEEDOR_VACIO, nombre: "Al" }))
      .toContain("nombre completo");
  });

  it("exige al menos un medio de contacto", () => {
    expect(validarContactoProveedor({ ...CONTACTO_PROVEEDOR_VACIO, nombre: "Ana López" }))
      .toContain("correo o teléfono");
  });

  it("valida el formato del correo", () => {
    expect(validarContactoProveedor({
      ...CONTACTO_PROVEEDOR_VACIO, nombre: "Ana López", email: "ana@mal",
    })).toContain("formato válido");
  });

  it("acepta un contacto correcto", () => {
    expect(validarContactoProveedor({
      ...CONTACTO_PROVEEDOR_VACIO, nombre: "Ana López", email: "ana@maersk.com",
    })).toBeNull();
  });
});

describe("contactosProveedor — orden y principal", () => {
  it("pone al principal primero y luego alfabético", () => {
    const lista = [
      contacto({ id: "b", nombre: "Zoe" }),
      contacto({ id: "c", nombre: "Beto" }),
      contacto({ id: "a", nombre: "Mario", es_principal: true }),
    ];
    expect(ordenarContactos(lista).map((c) => c.id)).toEqual(["a", "c", "b"]);
    expect(contactoPrincipal(lista)?.id).toBe("a");
    expect(contactoPrincipal([contacto({ id: "x" })])).toBeNull();
  });

  it("convierte un contacto a formulario sin nulos", () => {
    const form = contactoAForm(contacto({ notas: null, telefono: "555" }));
    expect(form.notas).toBe("");
    expect(form.telefono).toBe("555");
  });
});
