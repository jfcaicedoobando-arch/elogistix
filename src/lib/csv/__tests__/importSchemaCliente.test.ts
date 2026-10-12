import { describe, it, expect } from "vitest";
import { mapClienteRows, CLIENTE_TEMPLATE_HEADERS } from "../importSchemaCliente";
import type { Row } from "../importSchemasShared";

describe("mapClienteRows (importSchemaCliente)", () => {
  it("expone los headers de plantilla de cliente esperados", () => {
    expect(CLIENTE_TEMPLATE_HEADERS).toContain("nombre");
    expect(CLIENTE_TEMPLATE_HEADERS.length).toBe(12);
  });

  it("acepta fila mínima válida con defaults", () => {
    const rows: Row[] = [{ nombre: "Cliente Uno", email: "cliente@example.invalid" }];
    const { valid, invalid } = mapClienteRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.rfc).toBe("");
    expect(valid[0].payload.email).toBe("cliente@example.invalid");
    expect(valid[0].payload.dias_credito).toBeNull();
    expect(valid[0].payload.regimen_fiscal).toBeNull();
    expect(valid[0].rowNumber).toBe(2);
  });

  it("agrega organization_id si se provee", () => {
    const rows: Row[] = [{ nombre: "Cliente", email: "cliente@example.invalid" }];
    const { valid } = mapClienteRows(rows, "org-9");
    expect(valid[0].payload.organization_id).toBe("org-9");
  });

  it("no agrega organization_id si es null", () => {
    const rows: Row[] = [{ nombre: "Cliente", email: "cliente@example.invalid" }];
    const { valid } = mapClienteRows(rows, null);
    expect(valid[0].payload).not.toHaveProperty("organization_id");
  });

  it("rechaza nombre de cliente vacío", () => {
    const rows: Row[] = [{ nombre: "", email: "cliente@example.invalid" }];
    const { invalid } = mapClienteRows(rows, null);
    expect(invalid[0].message).toContain("Nombre: requerido");
  });

  it.each([
    { caso: "ausente", celda: {} },
    { caso: "undefined", celda: { email: undefined } },
    { caso: "null", celda: { email: null } },
    { caso: "vacío", celda: { email: "" } },
    { caso: "con espacios", celda: { email: " \t\r\n " } },
  ])("rechaza email $caso con mensaje requerido", ({ celda }) => {
    const raw: Row = { nombre: "X" };
    // Incluye datos externos malformados que pueden llegar en tiempo de ejecución.
    Object.assign(raw, celda);
    const { invalid, valid } = mapClienteRows([raw], null);
    expect(valid).toHaveLength(0);
    expect(invalid).toEqual([{ rowNumber: 2, message: "email: Correo: requerido.", raw }]);
    expect(invalid[0].raw).toBe(raw);
  });

  it.each(["malo", "cliente@", "@example.invalid", "cliente@example", "cliente @example.invalid"])(
    "rechaza email de cliente con formato inválido: %s",
    (email) => {
      const raw: Row = { nombre: "X", email };
      const { invalid, valid } = mapClienteRows([raw], null);
      expect(valid).toHaveLength(0);
      expect(invalid).toEqual([
        { rowNumber: 2, message: "email: Correo: formato inválido.", raw },
      ]);
    },
  );

  it.each([
    { email: "a@b.com", esperado: "a@b.com" },
    { email: "  Cliente.Unico+tag@example.invalid  ", esperado: "Cliente.Unico+tag@example.invalid" },
    { email: "\tcliente@example.invalid\r\n", esperado: "cliente@example.invalid" },
  ])("acepta email válido y recorta sus extremos: $email", ({ email, esperado }) => {
    const rows: Row[] = [{ nombre: "X", email }];
    const { invalid, valid } = mapClienteRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid).toHaveLength(1);
    expect(valid[0].payload.email).toBe(esperado);
    expect(rows[0].email).toBe(email);
  });

  it("marca las seis filas con correo vacío antes de confirmar la importación", () => {
    const rows: Row[] = Array.from({ length: 6 }, (_, index) => ({
      nombre: `Cliente ${index + 1}`, email: "",
    }));
    const { invalid, valid } = mapClienteRows(rows, "org-1");
    expect(valid).toHaveLength(0);
    expect(invalid.map(({ rowNumber }) => rowNumber)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(invalid.map(({ message }) => message)).toEqual(
      Array(6).fill("email: Correo: requerido."),
    );
    invalid.forEach((error, index) => expect(error.raw).toBe(rows[index]));
  });

  it("acepta el control de seis clientes con correos únicos", () => {
    const rows: Row[] = Array.from({ length: 6 }, (_, index) => ({
      nombre: `Cliente ${index + 1}`, email: `cliente${index + 1}@example.invalid`,
    }));
    const { invalid, valid } = mapClienteRows(rows, "org-1");
    expect(invalid).toHaveLength(0);
    expect(valid.map(({ rowNumber }) => rowNumber)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(valid.map(({ payload }) => payload.email)).toEqual(rows.map(({ email }) => email));
    expect(valid.every(({ payload }) => payload.organization_id === "org-1")).toBe(true);
  });

  it("acepta dias_credito vacío como null en cliente", () => {
    const rows: Row[] = [{ nombre: "X", email: "cliente@example.invalid", dias_credito: "" }];
    const { valid, invalid } = mapClienteRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.dias_credito).toBeNull();
  });

  it("convierte dias_credito numérico a Number", () => {
    const rows: Row[] = [{ nombre: "X", email: "cliente@example.invalid", dias_credito: "30" }];
    const { valid, invalid } = mapClienteRows(rows, null);
    expect(invalid).toHaveLength(0);
    expect(valid[0].payload.dias_credito).toBe(30);
  });

  it("rechaza dias_credito no entero", () => {
    const rows: Row[] = [{ nombre: "X", email: "cliente@example.invalid", dias_credito: "abc" }];
    const { invalid } = mapClienteRows(rows, null);
    expect(invalid[0].message).toContain("Días de crédito");
  });

  it("rechaza dias_credito negativo (no matchea regex)", () => {
    const rows: Row[] = [{ nombre: "X", email: "cliente@example.invalid", dias_credito: "-5" }];
    const { invalid } = mapClienteRows(rows, null);
    expect(invalid[0].message).toContain("Días de crédito");
  });

  it("completa todos los campos opcionales cuando vienen presentes", () => {
    const rows: Row[] = [{
      nombre: "Completo", email: "cliente@example.invalid", rfc: "XAXX010101000", telefono: "555", contacto: "Ana",
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

  it("procesa un lote mixto y conserva los números y datos originales por fila", () => {
    const rows: Row[] = [
      { nombre: "A", email: "  a@example.invalid  " },
      { nombre: "B", email: "" },
      { nombre: "C", email: "incorrecto" },
      { nombre: "", email: "d@example.invalid" },
      { nombre: "E", email: "E@example.invalid" },
    ];
    const { valid, invalid } = mapClienteRows(rows, null);
    expect(valid.map(({ rowNumber }) => rowNumber)).toEqual([2, 6]);
    expect(valid.map(({ payload }) => payload.email)).toEqual(["a@example.invalid", "E@example.invalid"]);
    expect(invalid.map(({ rowNumber }) => rowNumber)).toEqual([3, 4, 5]);
    expect(invalid.map(({ message }) => message)).toEqual([
      "email: Correo: requerido.", "email: Correo: formato inválido.", "nombre: Nombre: requerido.",
    ]);
    invalid.forEach((error) => expect(error.raw).toBe(rows[error.rowNumber - 2]));
    expect(rows[0].email).toBe("  a@example.invalid  ");
  });
});
