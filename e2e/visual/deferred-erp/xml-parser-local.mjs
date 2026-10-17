// Safe local alternative using the already installed Node/tsx runtime.
// This does not execute or substitute for the unexecuted Deno suite.
import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseCfdi } from "../../../supabase/functions/_shared/cfdiParser.ts";
import { errorIdentidadNc, validarNcProveedor } from "../../../supabase/functions/parse-cfdi-xml/validarNcProveedor.ts";

const networkAttempts = [];
globalThis.fetch = () => { networkAttempts.push("fetch"); throw new Error("External network forbidden"); };
globalThis.WebSocket = class { constructor() { networkAttempts.push("WebSocket"); throw new Error("WebSocket forbidden"); } };
const FACTURA = "11111111-1111-4111-8111-111111111111";
const NC = "22222222-2222-4222-8222-222222222222";
const ORG = "33333333-3333-4333-8333-333333333333";
const destination = { rfcProveedor: "AAA010101AAA", rfcOrganizacion: "BBB010101BBB", uuidFactura: FACTURA };
// Exact fictitious inline XML already present in validarNcProveedor_test.ts.
const xml = `<cfdi:Comprobante Version="4.0" TipoDeComprobante="E" Moneda="MXN" Total="58" SubTotal="50" Fecha="2026-10-04T12:00:00"><cfdi:CfdiRelacionados TipoRelacion="01"><cfdi:CfdiRelacionado UUID="${FACTURA}"/></cfdi:CfdiRelacionados><cfdi:Emisor Rfc="AAA010101AAA"/><cfdi:Receptor Rfc="BBB010101BBB"/><tfd:TimbreFiscalDigital UUID="${NC}"/></cfdi:Comprobante>`;
const assertions = [];
const passed = (name, check) => { check(); assertions.push({ name, passed: true }); };
const parsed = parseCfdi(xml);
passed("real parser preserves related invoice UUID", () => assert.deepEqual(parsed.relacionados, [FACTURA]));
passed("matching complete identity accepted", () => assert.equal(errorIdentidadNc(parsed, destination), null));
passed("RFC normalization accepted", () => assert.equal(errorIdentidadNc({ ...parsed, emisor: { ...parsed.emisor, rfc: " aaa010101aaa " } }, destination), null));
for (const [name, change, message] of [
  ["issuer", { emisor: { ...parsed.emisor, rfc: "CCC010101CCC" } }, /emisor/],
  ["receiver", { receptor: { ...parsed.receptor, rfc: "CCC010101CCC" } }, /receptor/],
  ["document type", { tipo_comprobante: "I" }, /egreso/],
  ["invoice UUID reused", { uuid: FACTURA }, /no puede ser/],
  ["invalid UUID", { uuid: "invalido" }, /UUID fiscal válido/],
  ["wrong relation", { relacionados: [NC] }, /no relaciona/],
  ["missing relation", { relacionados: [] }, /no relaciona/],
  ["unsupported currency", { moneda: "XXX" }, /moneda/],
  ["negative total", { total: -58 }, /positivo/],
  ["zero total", { total: 0 }, /positivo/],
  ["nonfinite total", { total: Number.NaN }, /positivo/],
]) passed(`rejects ${name}`, () => assert.match(errorIdentidadNc({ ...parsed, ...change }, destination), message));
passed("missing invoice UUID rejected", () => assert.match(errorIdentidadNc(parsed, { ...destination, uuidFactura: null }), /verificable/));
passed("missing organization RFC rejected", () => assert.match(errorIdentidadNc(parsed, { ...destination, rfcOrganizacion: null }), /Falta el RFC/));

const reads = [];
let missingInvoice = false;
let duplicate = false;
const client = { from(table) {
  const data = table === "proveedor_facturas" ? (missingInvoice ? null : { rfc_proveedor: destination.rfcProveedor, uuid_fiscal: FACTURA })
    : table === "organizations" ? { rfc: destination.rfcOrganizacion } : duplicate ? [{ id: NC }] : [];
  const query = {
    select: fields => { reads.push({ table, operation: "select", fields }); return query; },
    eq: (column, value) => { reads.push({ table, operation: "eq", column, value }); return query; },
    is: (column, value) => { reads.push({ table, operation: "is", column, value }); return query; },
    ilike: (column, value) => { reads.push({ table, operation: "ilike", column, value }); return query; },
    maybeSingle: async () => ({ data, error: null }), limit: async () => ({ data, error: null }),
  };
  return query;
} };
assert.equal(await validarNcProveedor(client, ORG, FACTURA, parsed), null);
assertions.push({ name: "matching identity accepted with read-only in-memory client", passed: true });
for (const table of ["proveedor_facturas", "proveedor_notas_credito"]) passed(`${table} scoped by organization`, () => assert.ok(reads.some(read => read.table === table && read.column === "organization_id" && read.value === ORG)));
duplicate = true;
assert.match(await validarNcProveedor(client, ORG, FACTURA, parsed), /Ya existe/);
assertions.push({ name: "duplicate credit-note UUID rejected", passed: true });
missingInvoice = true;
assert.match(await validarNcProveedor(client, ORG, FACTURA, parsed), /no está disponible/);
assertions.push({ name: "unavailable or foreign invoice rejected", passed: true });
passed("no network attempts", () => assert.deepEqual(networkAttempts, []));
const output = fileURLToPath(new URL("../../../test-results/xml-parser-local.json", import.meta.url));
await mkdir(fileURLToPath(new URL("../../../test-results/", import.meta.url)), { recursive: true });
await writeFile(output, JSON.stringify({ runtime: `Node ${process.version} with existing tsx`, denoSuiteExecuted: false, assertions, reads, networkAttempts }, null, 2));
console.log(`XML local parser: ${assertions.length} assertions passed; no network; Deno suite not executed.`);
