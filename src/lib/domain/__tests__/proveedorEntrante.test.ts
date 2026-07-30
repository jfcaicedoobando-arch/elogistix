import { describe, it, expect } from "vitest";
import { avisoProveedorEntrante } from "@/lib/domain/proveedorEntrante";
import { dedupeProveedores } from "@/features/embarques/services/queries/proveedores";

describe("avisoProveedorEntrante", () => {
  const base = {
    detectadoId: null,
    detectadoNombre: null,
    seleccionadoId: null,
    rfcEmisor: null,
    tieneXml: false,
  };

  it("avisa cuando no hay proveedor elegido", () => {
    expect(avisoProveedorEntrante(base)).toMatch(/Sin proveedor asignado/);
  });

  it("no avisa cuando el elegido coincide con el detectado", () => {
    expect(
      avisoProveedorEntrante({
        ...base,
        detectadoId: "p1",
        seleccionadoId: "p1",
        rfcEmisor: "AAA010101AAA",
        tieneXml: true,
      }),
    ).toBeNull();
  });

  it("avisa discrepancia cuando el RFC apunta a otro proveedor", () => {
    const aviso = avisoProveedorEntrante({
      detectadoId: "p1",
      detectadoNombre: "Naviera X",
      seleccionadoId: "p2",
      rfcEmisor: "AAA010101AAA",
      tieneXml: true,
    });
    expect(aviso).toContain("Naviera X");
    expect(aviso).toContain("AAA010101AAA");
  });

  it("avisa cuando el XML trae RFC sin proveedor dado de alta", () => {
    expect(
      avisoProveedorEntrante({
        ...base,
        seleccionadoId: "p2",
        rfcEmisor: "BBB020202BBB",
        tieneXml: true,
      }),
    ).toMatch(/Ningún proveedor/);
  });

  it("no avisa si sólo hay PDF y ya se eligió proveedor", () => {
    expect(avisoProveedorEntrante({ ...base, seleccionadoId: "p2" })).toBeNull();
  });
});

describe("dedupeProveedores", () => {
  it("deduplica por id, ignora nulos y ordena por nombre", () => {
    expect(
      dedupeProveedores([
        { proveedor_id: "b", proveedor_nombre: "Zeta" },
        { proveedor_id: null, proveedor_nombre: "Fantasma" },
        { proveedor_id: "a", proveedor_nombre: "Álfa" },
        { proveedor_id: "b", proveedor_nombre: "Zeta" },
      ]),
    ).toEqual([
      { id: "a", nombre: "Álfa" },
      { id: "b", nombre: "Zeta" },
    ]);
  });

  it("usa un nombre por defecto cuando falta", () => {
    expect(dedupeProveedores([{ proveedor_id: "a", proveedor_nombre: null }])).toEqual([
      { id: "a", nombre: "Proveedor sin nombre" },
    ]);
  });
});
