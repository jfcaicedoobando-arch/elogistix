import { describe, it, expect } from "vitest";
import { mapProveedorRows, PROVEEDOR_TEMPLATE_HEADERS, TIPOS_PROVEEDOR } from "../importSchemaProveedor";
import type { Row } from "../importSchemasShared";

describe("mapProveedorRows (importSchemaProveedor)", () => {
  it("expone los headers de plantilla de proveedor esperados", () => {
    expect(PROVEEDOR_TEMPLATE_HEADERS).toContain("nombre");
    expect(PROVEEDOR_TEMPLATE_HEADERS.length).toBe(10);
  });

  it("acepta fila válida logística mínima con defaults", () => {
    const rows: Row[] = [{ nombre: "Naviera Uno", tipo: "Naviera" }];
    const { valid, invalid } = mapProveedorRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.categoria).toBe("Logistico");
    expect(valid[0].payload.tipo).toBe("Naviera");
    expect(valid[0].payload.subtipo_gasto).toBeNull();
    expect(valid[0].payload.moneda_preferida).toBe("MXN");
    expect(valid[0].payload.rfc).toBe("");
    expect(valid[0].payload.pais).toBeNull();
    expect(valid[0].rowNumber).toBe(2);
  });

  it("aplica organizationId cuando se provee", () => {
    const rows: Row[] = [{ nombre: "Naviera Uno", tipo: "Naviera" }];
    const { valid } = mapProveedorRows(rows, "org-1");
    expect(valid[0].payload.organization_id).toBe("org-1");
  });

  it("no agrega organization_id cuando es null", () => {
    const rows: Row[] = [{ nombre: "Naviera Uno", tipo: "Naviera" }];
    const { valid } = mapProveedorRows(rows, null);
    expect(valid[0].payload).not.toHaveProperty("organization_id");
  });

  it("rechaza fila logística sin tipo", () => {
    const rows: Row[] = [{ nombre: "Sin tipo", categoria: "Logistico" }];
    const { invalid, valid } = mapProveedorRows(rows, null);
    expect(valid).toHaveLength(0);
    expect(invalid[0].message).toContain("Tipo: requerido");
  });

  it("aplica defaultTipo cuando falta tipo y categoria es logística", () => {
    const rows: Row[] = [{ nombre: "Con default" }];
    const { valid, invalid } = mapProveedorRows(rows, null, "Custodia");
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.tipo).toBe("Custodia");
  });

  it("no aplica defaultTipo si la categoria no es logística", () => {
    const rows: Row[] = [{ nombre: "Gasto op", categoria: "GastoOperativo", subtipo_gasto: "Renta" }];
    const { valid, invalid } = mapProveedorRows(rows, null, "Custodia");
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.tipo).toBeNull();
    expect(valid[0].payload.subtipo_gasto).toBe("Renta");
  });

  it("no sobreescribe tipo existente aunque haya defaultTipo", () => {
    const rows: Row[] = [{ nombre: "Ya tiene", tipo: "Aerolínea" }];
    const { valid } = mapProveedorRows(rows, null, "Custodia");
    expect(valid[0].payload.tipo).toBe("Aerolínea");
  });

  it("rechaza gasto operativo sin subtipo_gasto", () => {
    const rows: Row[] = [{ nombre: "Gasto sin subtipo", categoria: "GastoOperativo" }];
    const { invalid } = mapProveedorRows(rows, null);
    expect(invalid[0].message).toContain("Subtipo de gasto: requerido");
  });

  it("acepta gasto operativo válido y limpia tipo", () => {
    const rows: Row[] = [{ nombre: "Renta oficina", categoria: "GastoOperativo", subtipo_gasto: "Renta", tipo: "Naviera" }];
    const { valid, invalid } = mapProveedorRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.tipo).toBeNull();
    expect(valid[0].payload.subtipo_gasto).toBe("Renta");
  });

  it("rechaza nombre de proveedor vacío", () => {
    const rows: Row[] = [{ nombre: "", tipo: "Naviera" }];
    const { invalid } = mapProveedorRows(rows, null);
    expect(invalid[0].message).toContain("Nombre: requerido");
  });

  it("rechaza categoria inválida", () => {
    const rows: Row[] = [{ nombre: "X", categoria: "Otra" }];
    const { invalid } = mapProveedorRows(rows, null);
    expect(invalid[0].message).toContain("Categoría");
  });

  it("rechaza tipo inválido", () => {
    const rows: Row[] = [{ nombre: "X", tipo: "Invalido" }];
    const { invalid } = mapProveedorRows(rows, null);
    expect(invalid[0].message).toContain("Tipo:");
  });

  it("rechaza moneda_preferida inválida en proveedor", () => {
    const rows: Row[] = [{ nombre: "X", tipo: "Naviera", moneda_preferida: "GBP" }];
    const { invalid } = mapProveedorRows(rows, null);
    expect(invalid[0].message).toContain("Moneda");
  });

  it("acepta email vacío como literal válido", () => {
    const rows: Row[] = [{ nombre: "X", tipo: "Naviera", email: "" }];
    const { invalid, valid } = mapProveedorRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.email).toBe("");
  });

  it("rechaza email con formato inválido", () => {
    const rows: Row[] = [{ nombre: "X", tipo: "Naviera", email: "no-es-correo" }];
    const { invalid } = mapProveedorRows(rows, null);
    expect(invalid[0].message).toContain("Correo");
  });

  it("acepta email válido y campos opcionales completos", () => {
    const rows: Row[] = [{
      nombre: "Completo", tipo: "Naviera", rfc: "ABC010101XXX", contacto: "Juan",
      telefono: "555", email: "a@a.com", moneda_preferida: "USD", pais: "México",
    }];
    const { valid, invalid } = mapProveedorRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.email).toBe("a@a.com");
    expect(valid[0].payload.moneda_preferida).toBe("USD");
    expect(valid[0].payload.pais).toBe("México");
  });

  it("procesa múltiples filas asignando rowNumber correcto", () => {
    const rows: Row[] = [
      { nombre: "Uno", tipo: "Naviera" },
      { nombre: "", tipo: "Naviera" },
    ];
    const { valid, invalid } = mapProveedorRows(rows, null);
    expect(valid[0].rowNumber).toBe(2);
    expect(invalid[0].rowNumber).toBe(3);
  });

  it("incluye todos los TIPOS_PROVEEDOR en el enum exportado", () => {
    expect(TIPOS_PROVEEDOR.length).toBeGreaterThan(0);
  });
});
