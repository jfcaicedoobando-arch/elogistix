import { describe, it, expect } from "vitest";
import { resolverValorContactoDesdeTexto } from "../index";

const contactos = [
  { id: "c1", nombre: "HEBEI LONGDA", tipo: "Proveedor", pais: "CHINA" },
  { id: "c2", nombre: "ACME", tipo: "Cliente", pais: "MEX" },
];

describe("resolverValorContactoDesdeTexto", () => {
  it("devuelve vacío si el stored es nulo o vacío", () => {
    expect(resolverValorContactoDesdeTexto(null, contactos, "INDIMEX")).toEqual({ value: "", manual: "" });
    expect(resolverValorContactoDesdeTexto("   ", contactos, "INDIMEX")).toEqual({ value: "", manual: "" });
  });

  it("resuelve a __cliente__ cuando coincide con el nombre del cliente y se permite", () => {
    expect(
      resolverValorContactoDesdeTexto("INDIMEX TRADING", contactos, "INDIMEX TRADING", { permitirCliente: true }),
    ).toEqual({ value: "__cliente__", manual: "" });
  });

  it("no resuelve a __cliente__ si permitirCliente=false", () => {
    expect(
      resolverValorContactoDesdeTexto("INDIMEX TRADING", contactos, "INDIMEX TRADING"),
    ).toEqual({ value: "__otro__", manual: "INDIMEX TRADING" });
  });

  it("resuelve a contacto.id cuando coincide el formato completo", () => {
    expect(
      resolverValorContactoDesdeTexto("HEBEI LONGDA — Proveedor (CHINA)", contactos, null),
    ).toEqual({ value: "c1", manual: "" });
  });

  it("cae a __otro__ con el texto original cuando no hay match", () => {
    expect(
      resolverValorContactoDesdeTexto("DESCONOCIDO SA", contactos, "OTRO"),
    ).toEqual({ value: "__otro__", manual: "DESCONOCIDO SA" });
  });
});
