import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { fechaIso, prepararImportacion, type CatalogosImport } from "../importarTarifas";

const catalogos: CatalogosImport = {
  puertos: [{ id: "o", name: "Valparaíso", code: "CLVAP" }, { id: "d", name: "Manzanillo", code: "MXZLO" }],
  agentes: [{ id: "a", nombre: "Agénte Ñorte" }],
  navieras: [{ id: "n", name: "Océano", code: "OCN" }],
  tipos: [{ id: "20dv", code: "20DV" }, { id: "20gp", code: "20gp" }, { id: "40gp", code: "40GP" }, { id: "40hc", code: "40hc" }],
  rutas: [{ id: "r", puerto_origen_id: "o", puerto_destino_id: "d" }],
};
const fila = (cambios: Record<string, unknown> = {}) => ({
  Origen: " clvap ", Destino: "Mánzanillo", Agente: " AGENTE NORTE ", Naviera: "ocn",
  'Tarifa 20"': 1200, 'Tarifa 40”': 1500,
  Inicio: "15/10/2026", Término: "16/10/2026", Días: 14, Observaciones: "  nota  ",
  ...cambios,
});
const importar = (filas: ReadonlyArray<Record<string, unknown>>, cambios: Partial<CatalogosImport> = {}) =>
  prepararImportacion(filas, { ...catalogos, ...cambios });

function archivo(filas: unknown[][], formato: "csv" | "xlsx") {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), "Tarifas");
  const bytes: ArrayBuffer = XLSX.write(libro, { bookType: formato, type: "array" });
  const leido = XLSX.read(bytes, { type: "array", cellDates: true });
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(leido.Sheets[leido.SheetNames[0]], { defval: "" });
}

const encabezados = ["Orígen 20", "Destino 40", "Agénte 20", "Naviera 40", 'Tarifa 20”', 'Tarifa 40"', "Inicio", "Fin", "Días", "Observación", "Extra"];
const valores = ["clvap", "Manzanillo", "Agente Norte", "OCN", "$1,200.50 USD", "1.234,56", "15/10/2026", "16/10/2026", 1.5, "  nota  ", ""];

describe("archivos reales CSV/Excel", () => {
  it.each(["csv", "xlsx"] as const)("conserva el contrato de filas y montos de %s", (formato) => {
    const filas = archivo([encabezados, valores, [], ["", "", "", "", "", "", "", "", "", "", "ignorar"], ["inexistente", ...valores.slice(1)], valores], formato);
    // SheetJS omite la fila física 3; el importador numera el array recibido.
    expect(filas.map((r) => r.__rowNum__)).toEqual([1, 3, 4, 5]);
    const resultado = importar(filas);
    expect(resultado.errores).toEqual(["Fila 4: origen «inexistente» no existe en puertos"]);
    expect(resultado.tarifas.map(({ fila: numero, input }) => [numero, input.flete_base, input.dias_libres_demoras, input.notas]))
      .toEqual([[2, 1200.5, 1.5, "nota"], [2, 1.23456, 1.5, "nota"], [5, 1200.5, 1.5, "nota"], [5, 1.23456, 1.5, "nota"]]);
  });

  it("recibe fechas Date y celdas numéricas desde XLSX", () => {
    const filas = archivo([encabezados, [...valores.slice(0, 4), 1234.5678, 0, new Date(2026, 9, 15), new Date(2026, 9, 16), 0, "", ""]], "xlsx");
    expect(filas[0].Inicio).toBeInstanceOf(Date);
    expect(importar(filas)).toEqual({ errores: [], tarifas: [{ fila: 2, origenId: "o", destinoId: "d", input: {
      agente_id: "a", naviera_id: "n", ruta_id: "r", dias_libres_demoras: 0,
      vigente_desde: "2026-10-15", vigente_hasta: "2026-10-16", notas: null, recargos: [],
      tipo_contenedor_id: "20gp", flete_base: 1234.5678,
    } }] });
  });
});

describe("tolerancias existentes de fechas y números", () => {
  it.each([
    [new Date(2026, 0, 5, 23, 59), "2026-01-05"], [" 2026-1-5T10:00:00Z ", "2026-01-05"],
    ["5/1/2026", "2026-01-05"], ["31/02/2026", "2026-02-31"], ["2026-13-40 extra", "2026-13-40"],
    ["2026-1-234", "2026-01-23"], [new Date(NaN), null], [46200, null], [null, null], [undefined, null],
    ["", null], ["1/2/26", null], ["01/02/2026 extra", null],
  ])("fechaIso(%s) devuelve %s sin validar el calendario", (valor, esperado) => {
    expect(fechaIso(valor)).toBe(esperado);
  });

  it.each([[" $1,234.50 uSd\t", 1234.5], ["1.234,56", 1.23456], ["1e3", 1000], ["0x10", 16], [7.12345, 7.12345]])(
    "acepta monto %s como %s sin redondear", (valor, esperado) => {
      const resultado = importar([fila({ 'Tarifa 20"': valor, 'Tarifa 40”': "", Días: "USD 1.5" })]);
      expect(resultado.errores).toEqual([]);
      expect(resultado.tarifas.map(({ input }) => [input.flete_base, input.dias_libres_demoras])).toEqual([[esperado, 1.5]]);
    },
  );

  it.each(["NaN", "Infinity", "-1", "€20", "MXN 20"])("el monto inválido %s rechaza también la tarifa 40 válida", (valor) => {
    expect(importar([fila({ 'Tarifa 20"': valor })])).toEqual({ tarifas: [], errores: ["Fila 2: tarifa inválida"] });
  });

  it.each(["", null, "USD", "NaN", "Infinity", -1])("rechaza días libres %s", (valor) => {
    expect(importar([fila({ Días: valor })])).toEqual({ tarifas: [], errores: ["Fila 2: días libres inválidos"] });
  });

  it("acepta vigencia de un día y fechas imposibles si el orden textual es válido", () => {
    const resultado = importar([fila({ Inicio: "31/02/2026", Término: "31/02/2026" })]);
    expect(resultado.errores).toEqual([]);
    expect(resultado.tarifas.map(({ input }) => [input.vigente_desde, input.vigente_hasta]))
      .toEqual([["2026-02-31", "2026-02-31"], ["2026-02-31", "2026-02-31"]]);
  });
});

describe("orden de errores y omisiones", () => {
  it("acumula fallas en el orden original sin producir tarifas", () => {
    const resultado = importar([fila({ Origen: "O", Destino: "D", Agente: "A", Naviera: "N", Inicio: "mal", Término: "", Días: -1, 'Tarifa 20"': "mal", 'Tarifa 40”': -2 })]);
    expect(resultado).toEqual({ tarifas: [], errores: [
      'Fila 2: origen «O» no existe en puertos; destino «D» no existe en puertos; agente «A» no existe; naviera «N» no existe; fechas de vigencia inválidas (usa DD/MM/AAAA); días libres inválidos; tarifa inválida; falta la tarifa 20" o 40"',
    ] });
  });

  it("mantiene mismo puerto antes de agente, naviera y vigencia invertida", () => {
    expect(importar([fila({ Destino: "Valparaíso", Agente: "A", Naviera: "N", Inicio: "17/10/2026" })])).toEqual({ tarifas: [], errores: [
      "Fila 2: origen y destino son el mismo puerto; agente «A» no existe; naviera «N» no existe; el término de vigencia es anterior al inicio",
    ] });
  });

  it("omite filas vacías o desconocidas sin renumerar las restantes", () => {
    const resultado = importar([{}, { Extra: "dato" }, { Origen: " ", Días: null }, fila(), fila({ 'Tarifa 20"': 0, 'Tarifa 40”': " USD " })]);
    expect(resultado.tarifas.map((t) => t.fila)).toEqual([5, 5]);
    expect(resultado.errores).toEqual(['Fila 6: falta la tarifa 20" o 40"']);
  });

  it("catálogos vacíos generan sólo los errores previos a resolver tipos", () => {
    expect(importar([fila()], { puertos: [], agentes: [], navieras: [], tipos: [], rutas: [] })).toEqual({ tarifas: [], errores: [
      "Fila 2: origen « clvap » no existe en puertos; destino «Mánzanillo» no existe en puertos; agente « AGENTE NORTE » no existe; naviera «ocn» no existe",
    ] });
  });
});

describe("prioridades de encabezados y catálogos", () => {
  it.each([
    [undefined, []], [null, ["Fila 2: origen «» no existe en puertos"]], ["", ["Fila 2: origen «» no existe en puertos"]],
    ["desconocido", ["Fila 2: origen «desconocido» no existe en puertos"]],
  ])("el primer alias %s sólo puede sustituirse si es undefined", (primero, errores) => {
    const resultado = importar([{ "Orígen principal": primero, "Origen alternativo": "CLVAP", ...fila() }]);
    expect(resultado.errores).toEqual(errores);
    expect(resultado.tarifas).toHaveLength(errores.length ? 0 : 2);
  });

  it("prioriza 20 sobre 40 y tamaños sobre inicio, días y observaciones", () => {
    const resultado = importar([{ "Inicio 20/40": 25, "Días 40": 40, "Observación 20": 90, ...fila() }]);
    expect(resultado.errores).toEqual([]);
    expect(resultado.tarifas.map(({ input }) => [input.flete_base, input.dias_libres_demoras, input.notas])).toEqual([[25, 14, "nota"], [40, 14, "nota"]]);
  });

  it("prioriza código de puerto sobre nombre, pero primera naviera por nombre o código", () => {
    const resultado = importar([fila()], {
      puertos: [{ id: "nombre", name: "CLVAP", code: "OTRO" }, ...catalogos.puertos, { id: "duplicado", name: "Otro", code: "clvap" }],
      agentes: [...catalogos.agentes, { id: "a2", nombre: "Agente Norte" }],
      navieras: [{ id: "nombre-naviera", name: "OCN", code: "OTRO" }, ...catalogos.navieras],
      rutas: [...catalogos.rutas, { id: "r2", puerto_origen_id: "o", puerto_destino_id: "d" }],
    });
    expect(resultado.errores).toEqual([]);
    expect(resultado.tarifas.map(({ origenId, input }) => [origenId, input.agente_id, input.naviera_id, input.ruta_id]))
      .toEqual([["o", "a", "nombre-naviera", "r"], ["o", "a", "nombre-naviera", "r"]]);
  });

  it("resuelve puerto y naviera por nombre normalizado", () => {
    const resultado = importar([fila({ Origen: "VALPARAISO", Naviera: " OCEANO " })]);
    expect(resultado.errores).toEqual([]);
    expect(resultado.tarifas[0].origenId).toBe("o");
    expect(resultado.tarifas[0].input.naviera_id).toBe("n");
  });

  it("un origen ausente coincide con el primer código de puerto null", () => {
    const resultado = importar([fila({ Origen: undefined })], { puertos: [{ id: "sin-codigo", name: "Otro", code: null }, ...catalogos.puertos] });
    expect(resultado.errores).toEqual([]);
    expect(resultado.tarifas[0]).toMatchObject({ origenId: "sin-codigo", destinoId: "d", input: { ruta_id: "" } });
  });
});

describe("tipos, rutas y payload", () => {
  it.each([
    [[{ id: "20fallback", code: "20RF" }, { id: "20dv", code: "20DV" }, { id: "20gp", code: "20gp" }, { id: "20gp2", code: "20GP" }, { id: "40dv", code: "40DV" }, { id: "40gp", code: "40GP" }, { id: "40hc", code: "40hc" }], ["20gp", "40hc"]],
    [[{ id: "20dv", code: "20dv" }, { id: "40dv", code: "40DV" }, { id: "40gp", code: "40GP" }], ["20dv", "40gp"]],
    [[{ id: "20rf", code: "20RF" }, { id: "20ot", code: "20OT" }, { id: "40dv", code: "40dv" }], ["20rf", "40dv"]],
    [[{ id: "20espacio", code: "20GP " }, { id: "20rf", code: "20RF" }, { id: "40rf", code: "40RF" }, { id: "40ot", code: "40OT" }], ["20espacio", "40rf"]],
  ])("selecciona preferencias exactas y luego el primer prefijo: %j", (tipos, esperado) => {
    const resultado = importar([fila()], { tipos: tipos as CatalogosImport["tipos"] });
    expect(resultado.errores).toEqual([]);
    expect(resultado.tarifas.map(({ input }) => input.tipo_contenedor_id)).toEqual(esperado);
  });

  it.each([
    [[{ id: "20", code: "20GP" }], ["20"], ['Fila 2: no hay tipo de contenedor de 40" en el catálogo']],
    [[{ id: "40", code: "40HC" }], ["40"], ['Fila 2: no hay tipo de contenedor de 20" en el catálogo']],
    [[], [], ['Fila 2: no hay tipo de contenedor de 20" en el catálogo', 'Fila 2: no hay tipo de contenedor de 40" en el catálogo']],
  ])("admite éxito parcial por tamaño: %j", (tipos, esperado, errores) => {
    const resultado = importar([fila()], { tipos: tipos as CatalogosImport["tipos"] });
    expect(resultado.tarifas.map(({ input }) => input.tipo_contenedor_id)).toEqual(esperado);
    expect(resultado.errores).toEqual(errores);
  });

  it("no exige un tipo para montos cero o ausentes y continúa tras errores", () => {
    const resultado = importar([fila(), fila({ 'Tarifa 20"': 0 }), fila({ 'Tarifa 20"': undefined }), fila({ Agente: "X" })], { tipos: [{ id: "40", code: "40HC" }] });
    expect(resultado.tarifas.map(({ fila: numero, input }) => [numero, input.tipo_contenedor_id])).toEqual([[2, "40"], [3, "40"], [4, "40"]]);
    expect(resultado.errores).toEqual(['Fila 2: no hay tipo de contenedor de 20" en el catálogo', 'Fila 5: agente «X» no existe']);
  });

  it("mantiene las claves exactas del payload y no trata la ruta inversa como existente", () => {
    const resultado = importar([Object.freeze(fila({ Origen: "MXZLO", Destino: "CLVAP", Observaciones: 0 }))]);
    const base = { agente_id: "a", naviera_id: "n", ruta_id: "", dias_libres_demoras: 14, vigente_desde: "2026-10-15", vigente_hasta: "2026-10-16", notas: "0", recargos: [] };
    expect(resultado).toEqual({ errores: [], tarifas: [
      { fila: 2, origenId: "d", destinoId: "o", input: { ...base, tipo_contenedor_id: "20gp", flete_base: 1200 } },
      { fila: 2, origenId: "d", destinoId: "o", input: { ...base, tipo_contenedor_id: "40hc", flete_base: 1500 } },
    ] });
    expect(resultado.tarifas[0].input.recargos).toBe(resultado.tarifas[1].input.recargos);
  });
});
