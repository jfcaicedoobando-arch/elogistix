/** Pruebas de los parsers de correos de tarifas con fragmentos reales. */
import { describe, expect, it } from "vitest";
import { parsearOriental } from "./parsearOriental";
import { parsearGolden } from "./parsearGolden";
import { parsearLongsail } from "./parsearLongsail";
import { parsearRainbow } from "./parsearRainbow";
import { cortarHistorial, fechaTextoIso } from "./comun";

const HOY = "2026-10-13";
const ANIO = 2026;

describe("comun", () => {
  it("convierte fechas «21-Oct» y «21th-October» a ISO", () => {
    expect(fechaTextoIso("21-Oct", ANIO)).toBe("2026-10-21");
    expect(fechaTextoIso("1st-August", ANIO)).toBe("2026-08-01");
    expect(fechaTextoIso("21/10", ANIO)).toBe("2026-10-21");
  });

  it("corta el historial citado del correo", () => {
    const texto = "Tarifas nuevas\nRate: USD100/200\nFrom: Juan Luis Martinez\nRate: USD999/999";
    expect(cortarHistorial(texto)).toBe("Tarifas nuevas\nRate: USD100/200");
  });
});

describe("parsearOriental", () => {
  const correo = `Dear Juan:
Good day!
Here is the update ocean freght from 15th-Oct till 21th-Oct, please check:

1.
POL: Shenzhen/Shanghai/Ningbo/Qingdao
POD: Manzanillo/Lazaro Cardenas
Rate: USD4350/4850; 20GP/40HQ
Carrier: TSL
21 days free time
Validity time from 19th-Oct till 25th-Oct

2.
POL: Shenzhen/Shanghai/Ningbo/Qingdao/Xingang/Dalian/Xiamen
POD: Manzanillo/Lazaro Cardenas
Rate: USD5600/5900; 20GP/40HQ
Carrier: COSCO/OOCL
21 days free time
Validity time from 15th-Oct till 21th-Oct

From: Juan Luis Martinez
Date: 2026-09-29 08:31
1.
POL: Shenzhen
POD: Manzanillo/Lazaro Cardenas
Rate: USD9999/9999; 20GP/40HQ
Carrier: MSK
21 days free time
Validity time from 14th-September till 30th-September`;

  it("extrae una fila por puerto de origen y destino, sin el historial citado", () => {
    const { filas, errores } = parsearOriental(correo, ANIO, HOY);
    expect(errores).toEqual([]);
    // Bloque 1: 4 orígenes × 2 destinos; bloque 2: 7 × 2. El bloque citado no entra.
    expect(filas).toHaveLength(22);
    expect(filas.every((f) => f["Tarifa 20"] !== 9999)).toBe(true);
    const primera = filas[0];
    expect(primera).toMatchObject({
      Origen: "Shenzhen", Destino: "Manzanillo", Agente: "ORIENTAL INTERNATIONAL",
      Naviera: "TXZJ", "Tarifa 20": 4350, "Tarifa 40": 4850,
      "Inicio de la vigencia": "2026-10-19", "Término de la vigencia": "2026-10-25", "Días libres": 21,
    });
    const cosco = filas.find((f) => f.Origen === "Xiamen" && f.Destino === "Lázaro Cárdenas");
    expect(cosco).toMatchObject({ Naviera: "COSU", "Tarifa 40": 5900 });
    expect(cosco?.Observaciones).toContain("COSCO/OOCL");
  });
});

describe("parsearGolden", () => {
  const correo = `following our rate fyi:
SSL POL MANZANILLO/LAZARO ENSENADA Free time Valid 
20GP 40GP&40HQ 20GP 40GP&40HQ 
CMA Base Ports  5600 5900 / / 21 days 21-Oct 
EMC 5700 6000 / / 
WHL 5500 5800 5600 5900 
hope the above is useful for you`;

  it("expande Base Ports y omite Ensenada cuando viene «/»", () => {
    const { filas, errores } = parsearGolden(correo, ANIO, HOY);
    expect(errores).toEqual([]);
    // CMA: 9 puertos × 2 destinos; EMC: 9 × 2; WHL: 9 × 3 (incluye Ensenada)
    expect(filas).toHaveLength(63);
    const cma = filas.find((f) => f.Naviera === "CMDU");
    expect(cma).toMatchObject({
      Agente: "SHENZHEN GOLDEN SHIPPING", "Tarifa 20": 5600, "Tarifa 40": 5900,
      "Término de la vigencia": "2026-10-21", "Días libres": 21,
    });
    expect(filas.filter((f) => f.Destino === "Ensenada")).toHaveLength(9);
    expect(filas.filter((f) => f.Naviera === "EGLV").every((f) => f.Destino !== "Ensenada")).toBe(true);
  });
});

describe("parsearLongsail", () => {
  const correo = `1:Pls kindly check MSK SPOT for your reference:
2: VALIDITY: From 18-Oct to 29-Oct,2026 ( unit: USD) prepaid
POLO/F(USD)Free timeCarrierETDTT
20GP40GP/40HQ
Yantian5061558621daysMSK SPOT29-Oct33-35 days around
Qingdao4950545021daysMSK SPOT25-Oct28 days around

3:Pls kindly check booking instruction for your reference:
POLPOD O/F (20GP) +Subject to O/F (40HQ) +Subject toETDCARRIERFREE TIMECommoditySpace situation
SHENZHENMANZANILLO /LAZARO4950495019-OctPI'20General cargoSpace is OK
SHANGHAIMANZANILLO 5000530021-OctYM'21General cargoSpace is OK
QINGDAOMANZANILLO /LAZARO5200530018-OctMSC SPOT21General cargoSpace is OK`;

  it("lee la tabla SPOT y la de booking con siglas de naviera", () => {
    const { filas, errores } = parsearLongsail(correo, ANIO, HOY);
    expect(errores).toEqual([]);
    // SPOT: 2 orígenes × 2 destinos; booking: 2 + 1 + 2
    expect(filas).toHaveLength(9);
    const spot = filas.find((f) => f.Origen === "Yantian");
    expect(spot).toMatchObject({
      Naviera: "MAEU", "Tarifa 20": 5061, "Tarifa 40": 5586,
      "Inicio de la vigencia": "2026-10-18", "Término de la vigencia": "2026-10-29", "Días libres": 21,
    });
    const pil = filas.find((f) => f.Origen === "SHENZHEN" && f.Destino === "Lázaro Cárdenas");
    expect(pil).toMatchObject({ Naviera: "PCIU", "Tarifa 20": 4950, "Días libres": 20 });
    const msc = filas.find((f) => f.Origen === "QINGDAO" && f.Destino === "Manzanillo");
    expect(msc).toMatchObject({ Naviera: "MSCU", "Tarifa 40": 5300 });
  });
});

describe("parsearRainbow", () => {
  const hoja: unknown[][] = [
    ["POL", "POD", "Carrier", "Ocean Freight(CC)", "", "", "Free Days", "Effectitive Date", "Expired Date", "Subject to surcharges(PP)", "ETD", "Transit Time"],
    ["", "", "", "20GP", "40GP", "40HQ", "", "", "", "", "", ""],
    ["Shenzhen", "Manzanillo\nLazaro cardenas+100/200\nEnsenada", "YML", 4700, 5000, 5000, "21 free days", new Date(2026, 9, 16), new Date(2026, 9, 21), "", "Eve Sun", 23],
    ["Shanghai", "", "", 4700, 5000, 5000, "", "", "", "", "Every Sat", 20],
    ["Huangpu\nNansha", "", "", 4800, 5200, 5200, "", "", "", "", "Feeder", 30],
  ];

  it("hereda celdas combinadas y sólo crea Manzanillo y Lázaro", () => {
    const { filas, errores } = parsearRainbow(hoja, HOY);
    expect(errores).toEqual([]);
    // Shenzhen 2 destinos + Shanghai 2 + (Huangpu, Nansha) 2 c/u = 8
    expect(filas).toHaveLength(8);
    expect(filas.every((f) => f.Destino !== "Ensenada")).toBe(true);
    const sh = filas.find((f) => f.Origen === "Shanghai" && f.Destino === "Lázaro Cárdenas");
    expect(sh).toMatchObject({
      Agente: "RAINBOW LOGISTICS", Naviera: "YMLU", "Tarifa 20": 4700, "Tarifa 40": 5000,
      "Inicio de la vigencia": "2026-10-16", "Término de la vigencia": "2026-10-21", "Días libres": 21,
    });
    expect(sh?.Observaciones).toContain("+100/200");
    expect(filas.some((f) => f.Origen === "Nansha")).toBe(true);
  });
});
