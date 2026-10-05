import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { errorIdentidadNc, validarNcProveedor } from "./validarNcProveedor.ts";
import { parseCfdi, type CfdiParsed } from "../_shared/cfdiParser.ts";
import type { AuthContext } from "../_shared/auth.ts";

const FACTURA = "11111111-1111-4111-8111-111111111111";
const NC = "22222222-2222-4222-8222-222222222222";
const ORG = "33333333-3333-4333-8333-333333333333";
const destino = { rfcProveedor: "AAA010101AAA", rfcOrganizacion: "BBB010101BBB", uuidFactura: FACTURA };
const xml = `<cfdi:Comprobante Version="4.0" TipoDeComprobante="E" Moneda="MXN" Total="58" SubTotal="50" Fecha="2026-10-04T12:00:00"><cfdi:CfdiRelacionados TipoRelacion="01"><cfdi:CfdiRelacionado UUID="${FACTURA}"/></cfdi:CfdiRelacionados><cfdi:Emisor Rfc="AAA010101AAA"/><cfdi:Receptor Rfc="BBB010101BBB"/><tfd:TimbreFiscalDigital UUID="${NC}"/></cfdi:Comprobante>`;
const valido = () => parseCfdi(xml);

Deno.test("96: conserva la relación del XML y acepta identidad completa coincidente", () => {
  assertEquals(valido().relacionados, [FACTURA]);
  assertEquals(errorIdentidadNc(valido(), destino), null);
  assertEquals(errorIdentidadNc({ ...valido(), emisor: { ...valido().emisor, rfc: " aaa010101aaa " } }, destino), null);
});

Deno.test("96: rechaza emisor, receptor, tipo, UUID y relación antes del prefill", () => {
  const casos: [Partial<CfdiParsed>, string][] = [
    [{ emisor: { rfc: "CCC010101CCC", nombre: "Otro", regimen: "601" } }, "emisor"],
    [{ receptor: { rfc: "CCC010101CCC", nombre: "Otro" } }, "receptor"],
    [{ tipo_comprobante: "I" }, "egreso"],
    [{ uuid: FACTURA }, "no puede ser"],
    [{ uuid: "invalido" }, "UUID fiscal válido"],
    [{ relacionados: [NC] }, "no relaciona"],
    [{ relacionados: [] }, "no relaciona"],
    [{ moneda: "XXX" }, "moneda"],
    [{ total: -58 }, "positivo"],
  ];
  for (const [cambio, mensaje] of casos) assertStringIncludes(errorIdentidadNc({ ...valido(), ...cambio }, destino) ?? "", mensaje);
  assertStringIncludes(errorIdentidadNc(valido(), { ...destino, uuidFactura: null }) ?? "", "verificable");
  assertStringIncludes(errorIdentidadNc(valido(), { ...destino, rfcOrganizacion: null }) ?? "", "Falta el RFC");
});

Deno.test("96: lecturas aisladas por organización y rechaza duplicados o factura ajena", async () => {
  const filtros: unknown[][] = [];
  let ausente = false;
  let duplicada = false;
  const cliente = { from: (tabla: string) => {
    const data = tabla === "proveedor_facturas" ? (ausente ? null : { rfc_proveedor: destino.rfcProveedor, uuid_fiscal: FACTURA })
      : tabla === "organizations" ? { rfc: destino.rfcOrganizacion } : duplicada ? [{ id: NC }] : [];
    const q = { select: () => q, eq: (col: string, v: unknown) => { filtros.push([tabla, col, v]); return q; },
      is: () => q, ilike: () => q, maybeSingle: async () => ({ data, error: null }), limit: async () => ({ data, error: null }) };
    return q;
  } } as unknown as AuthContext["adminClient"];
  assertEquals(await validarNcProveedor(cliente, ORG, FACTURA, valido()), null);
  for (const tabla of ["proveedor_facturas", "proveedor_notas_credito"]) {
    assertEquals(filtros.some((f) => f[0] === tabla && f[1] === "organization_id" && f[2] === ORG), true);
  }
  duplicada = true;
  assertStringIncludes(await validarNcProveedor(cliente, ORG, FACTURA, valido()) ?? "", "Ya existe");
  ausente = true;
  assertStringIncludes(await validarNcProveedor(cliente, ORG, FACTURA, valido()) ?? "", "no está disponible");
});
