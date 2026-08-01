import { describe, it, expect } from "vitest";
import { mapClienteRows, CLIENTE_TEMPLATE_HEADERS } from "../importSchemaCliente";
import type { Row } from "../importSchemasShared";

describe("mapClienteRows (importSchemaCliente)", () => {
  it("expone los headers de plantilla de cliente esperados", () => {
    expect(CLIENTE_TEMPLATE_HEADERS).toContain("nombre");
    expect(CLIENTE_TEMPLATE_HEADERS.length).toBe(12);
  });

  it("acepta fila mínima válida con defaults", () => {
    const rows: Row[] = [{ nombre: "Cliente Uno" }];
    const { valid, invalid } = mapClienteRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.rfc).toBe("");
    expect(valid[0].payload.email).toBe("");
    expect(valid[0].payload.dias_credito).toBeNull();
    expect(valid[0].payload.regimen_fiscal).toBeNull();
    expect(valid[0].rowNumber).toBe(2);
  });

  it("agrega organization_id si se provee", () => {
    const rows: Row[] = [{ nombre: "Cliente" }];
    const { valid } = mapClienteRows(rows, "org-9");
    expect(valid[0].payload.organization_id).toBe("org-9");
  });

  it("no agrega organization_id si es null", () => {
    const rows: Row[] = [{ nombre: "Cliente" }];
    const { valid } = mapClienteRows(rows, null);
    expect(valid[0].payload).not.toHaveProperty("organization_id");
  });

  it("rechaza nombre de cliente vacío", () => {
    const rows: Row[] = [{ nombre: "" }];
    const { invalid } = mapClienteRows(rows, null);
    expect(invalid[0].message).toContain("Nombre: requerido");
  });

  it("acepta email vacío", () => {
    const rows: Row[] = [{ nombre: "X", email: "" }];
    const { invalid, valid } = mapClienteRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.email).toBe("");
  });

  it("rechaza email de cliente con formato inválido", () => {
    const rows: Row[] = [{ nombre: "X", email: "malo" }];
    const { invalid } = mapClienteRows(rows, null);
    expect(invalid[0].message).toContain("Correo");
  });

  it("acepta email válido", () => {
    const rows: Row[] = [{ nombre: "X", email: "a@b.com" }];
    const { invalid, valid } = mapClienteRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.email).toBe("a@b.com");
  });

  it("acepta dias_credito vacío como null en cliente", () => {
    const rows: Row[] = [{ nombre: "X", dias_credito: "" }];
    const { valid, invalid } = mapClienteRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.dias_credito).toBeNull();
  });

  it("convierte dias_credito numérico a Number", () => {
    const rows: Row[] = [{ nombre: "X", dias_credito: "30" }];
    const { valid, invalid } = mapClienteRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.dias_credito).toBe(30);
  });

  it("rechaza dias_credito no entero", () => {
    const rows: Row[] = [{ nombre: "X", dias_credito: "abc" }];
    const { invalid } = mapClienteRows(rows, null);
    expect(invalid[0].message).toContain("Días de crédito");
  });

  it("rechaza dias_credito negativo (no matchea regex)", () => {
    const rows: Row[] = [{ nombre: "X", dias_credito: "-5" }];
    const { invalid } = mapClienteRows(rows, null);
    expect(invalid[0].message).toContain("Días de crédito");
  });

  it("completa todos los campos opcionales cuando vienen presentes", () => {
    const rows: Row[] = [{
      nombre: "Completo", rfc: "XAXX010101000", telefono: "555", contacto: "Ana",
      direccion: "Calle 1", ciudad: "CDMX", estado: "CDMX", cp: "01000",
      dias_credito: "15", regimen_fiscal: "601", uso_cfdi_default: "G03",
    }];
    const { valid, invalid } = mapClienteRows(rows, null);
    expect(invalid).toHaveLength(0);
    const p = valid[0].payload;
    expect(p.rfc).toBe("XAXX010101000");
    expect(p.direccion).toBe("Calle 1");
    expect(p.dias_credito).toBe(15);
    expect(p.regimen_fiscal).toBe("601");
    expect(p.uso_cfdi_default).toBe("G03");
  });

  it("procesa múltiples filas con rowNumber consecutivo", () => {
    const rows: Row[] = [{ nombre: "A" }, { nombre: "" }];
    const { valid, invalid } = mapClienteRows(rows, null);
    expect(valid[0].rowNumber).toBe(2);
    expect(invalid[0].rowNumber).toBe(3);
  });
});
