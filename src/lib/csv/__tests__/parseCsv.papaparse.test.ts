import { describe, expect, it } from "vitest";
import { parseCsv } from "../parseCsv";

describe("CSV: compatibilidad de PapaParse con los importadores", () => {
  it.each([",", ";"] as const)("conserva identificadores como texto con %s", (delimiter) => {
    const csv = [
      ["RFC", "Teléfono", "Código Postal", "Referencia", "Activo", "Importe"].join(delimiter),
      ["XAXX010101000", "00525512345678", "00123", "00001234567890123456789", "true", "-171.92"].join(delimiter),
    ].join("\r\n");
    expect(parseCsv(`\uFEFF${csv}\r\n`).rows).toEqual([{
      rfc: "XAXX010101000", telefono: "00525512345678", codigo_postal: "00123",
      referencia: "00001234567890123456789", activo: "true", importe: "-171.92",
    }]);
  });

  it("conserva normalización, alias, duplicados y posiciones vacías", () => {
    const parsed = parseCsv(',"Razón\uFEFF Social",Correo,correo,Teléfono,\nignorado,Acme,a@b.mx,c@d.mx,0052,ignorado', {
      headerAliases: { "RAZÓN SOCIAL": "Nombre", correo: "Email" },
    });
    expect(parsed.headers).toEqual(["nombre", "email", "email_2", "telefono"]);
    expect(parsed.rows).toEqual([{ nombre: "Acme", email: "a@b.mx", email_2: "c@d.mx", telefono: "0052" }]);
  });

  it("rellena faltantes, ignora sobrantes y conserva el orden de filas", () => {
    expect(parseCsv("nombre,rfc\nAcme\nBeta,X1,sobrante\n,\n  , \nGamma,X2").rows).toEqual([
      { nombre: "Acme", rfc: "" },
      { nombre: "Beta", rfc: "X1" },
      { nombre: "Gamma", rfc: "X2" },
    ]);
  });

  it.each([
    ['"Nombre, legal";RFC\n"Acme, SA";X1', ";"],
    ['"Nombre; legal",RFC\n"Acme; SA",X1', ","],
    ["a,b;c\nx,y;z", ","],
    ["nombre\nAcme;con;separadores", ","],
    ["nombre,rfc\nAcme;dato;extra,X1\nBeta;dato;extra,X2", ","],
  ] as const)("selecciona por el encabezado y resuelve empates con coma: %s", (csv, delimiter) => {
    expect(parseCsv(csv).delimiter).toBe(delimiter);
  });

  it("normaliza CRLF/CR y conserva saltos internos, comillas escapadas y su espacio", () => {
    expect(parseCsv('nombre,nota\r\nAcme,"primera,  ""citada""\r\nsegunda;  ""citada"""\rBeta,final\r').rows).toEqual([
      { nombre: "Acme", nota: 'primera,  "citada"\nsegunda;  "citada"' },
      { nombre: "Beta", nota: "final" },
    ]);
  });

  it.each([
    'nombre,nota\nAcme,"sin cerrar',
    'nombre,nota\nAcme,"primera\nsegunda',
    'nombre,nota\nAcme,"cerrada"texto',
    'nombre;nota\nAcme;"sin cerrar',
  ])("rechaza comillas inválidas sin producir una vista previa parcial: %s", (csv) => {
    expect(() => parseCsv(csv)).toThrow(/CSV inválido en la fila 2:.*comillas/);
  });

  it.each([
    'nombre,nota\nAcme, "uno,dos"',
    'nombre,nota\n  "Acme, SA",nota',
    'nombre;nota\nAcme;\t"uno;dos"',
    ' "nombre",nota\nAcme,nota',
    'nombre,nota\nx"z,  "uno,dos"',
    'nombre;nota\nx"z;  "uno;dos"',
    'nombre,nota\nAcme,\u00a0"uno,dos"',
    'nombre;nota\nAcme;\u00a0"uno;dos"',
  ])("rechaza espacios antes de comillas que Papa trataría como datos: %s", (csv) => {
    expect(() => parseCsv(csv)).toThrow("elimina los espacios antes de las comillas de apertura");
  });

  it("no confunde espacios/comillas del contenido citado con apertura, aunque haya espacio al cerrar", () => {
    expect(parseCsv('nombre,nota\nAcme,"primera,  ""citada""\nsegunda"  ,ignorada').rows).toEqual([
      { nombre: "Acme", nota: 'primera,  "citada"\nsegunda' },
    ]);
  });
});
