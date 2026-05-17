import { describe, it, expect } from "vitest";
import { mapClienteRows, mapProveedorRows } from "../importSchemas";

describe("mapClienteRows", () => {
  it("valida nombres requeridos y normaliza campos opcionales vacíos", () => {
    const res = mapClienteRows(
      [
        { nombre: "Acme S.A.", rfc: "ABC100101AAA", email: "a@b.com", dias_credito: "30" },
        { nombre: "", rfc: "X1" },
        { nombre: "Beta", email: "no-es-email" },
        { nombre: "Gamma", dias_credito: "abc" },
      ],
      "org-1",
    );
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0].payload.nombre).toBe("Acme S.A.");
    expect(res.valid[0].payload.dias_credito).toBe(30);
    expect(res.valid[0].payload.organization_id).toBe("org-1");
    expect(res.invalid).toHaveLength(3);
    expect(res.invalid.map((e) => e.rowNumber)).toEqual([3, 4, 5]);
  });

  it("acepta dias_credito vacío como null", () => {
    const res = mapClienteRows([{ nombre: "X", dias_credito: "" }], null);
    expect(res.valid[0].payload.dias_credito).toBeNull();
    expect(res.valid[0].payload.organization_id).toBeUndefined();
  });
});

describe("mapProveedorRows", () => {
  it("rechaza tipos inválidos y exige nombre", () => {
    const res = mapProveedorRows(
      [
        { nombre: "Maersk", tipo: "Naviera", moneda_preferida: "USD" },
        { nombre: "X", tipo: "Inventado" },
        { nombre: "", tipo: "Naviera" },
      ],
      "org-1",
    );
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0].payload.tipo).toBe("Naviera");
    expect(res.valid[0].payload.moneda_preferida).toBe("USD");
    expect(res.invalid).toHaveLength(2);
  });

  it("usa tipo por defecto cuando la fila no lo trae", () => {
    const res = mapProveedorRows([{ nombre: "FlyOne" }], null, "Aerolínea");
    expect(res.valid[0].payload.tipo).toBe("Aerolínea");
    expect(res.valid[0].payload.moneda_preferida).toBe("MXN");
  });
});
