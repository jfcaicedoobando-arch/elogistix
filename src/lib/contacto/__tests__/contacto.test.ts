import { describe, it, expect } from "vitest";
import { resolverContacto, resolverValorContactoDesdeTexto } from "../index";

const cs = [
  { id: "c1", nombre: "Shipper SA", tipo: "Shipper", pais: "CN" },
  { id: "c2", nombre: "Notify Co", tipo: "Notify", pais: "MX" },
];

describe("resolverContacto", () => {
  it("devuelve el manual recortado cuando value='__otro__'", () => {
    expect(resolverContacto(cs, "__otro__", "  Manual  ")).toBe("Manual");
  });
  it("formatea contacto encontrado", () => {
    expect(resolverContacto(cs, "c1", "")).toBe("Shipper SA — Shipper (CN)");
  });
  it("retorna el valor original cuando no hay match", () => {
    expect(resolverContacto(cs, "desconocido", "")).toBe("desconocido");
  });
});

describe("resolverValorContactoDesdeTexto (lib/contacto)", () => {
  it("string vacío → value='' manual=''", () => {
    expect(resolverValorContactoDesdeTexto("", cs, "Cliente")).toEqual({ value: "", manual: "" });
    expect(resolverValorContactoDesdeTexto(null, cs, "Cliente")).toEqual({ value: "", manual: "" });
  });

  it("resuelve a '__cliente__' cuando coincide con nombre del cliente y se permite", () => {
    expect(
      resolverValorContactoDesdeTexto("Cliente X", cs, "Cliente X", { permitirCliente: true }),
    ).toEqual({ value: "__cliente__", manual: "" });
  });

  it("ignora cliente si permitirCliente=false", () => {
    expect(
      resolverValorContactoDesdeTexto("Cliente X", cs, "Cliente X"),
    ).toEqual({ value: "__otro__", manual: "Cliente X" });
  });

  it("hace match exacto por formato completo", () => {
    const r = resolverValorContactoDesdeTexto("Shipper SA — Shipper (CN)", cs, null);
    expect(r.value).toBe("c1");
  });

  it("hace match por nombre suelto", () => {
    const r = resolverValorContactoDesdeTexto("Notify Co", cs, null);
    expect(r.value).toBe("c2");
  });

  it("fallback __otro__ con manual cuando no hay match", () => {
    expect(resolverValorContactoDesdeTexto("Random", cs, null)).toEqual({
      value: "__otro__",
      manual: "Random",
    });
  });
});
