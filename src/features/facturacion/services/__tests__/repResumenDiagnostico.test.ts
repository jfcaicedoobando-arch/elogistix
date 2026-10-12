import { describe, expect, it } from "vitest";
import { diagnosticoResumenRep } from "../repResumenDiagnostico";
import { parseFunctionError, toReadableError } from "../facturapiError";
import { extractErrorDetails } from "@/lib/ui/errorDetailsExtract";
import { formatReportJson, formatReportMarkdown, type ErrorReport } from "@/lib/ui/errorReport";

// Provider/tax values are synthetic; SF437186's actual comparison is unknown.
const body = {
  error: "rep_resumen_divergente", message: "El saldo no coincide", moneda: "USD", tolerancia: 0.01,
  divergencias: ["Saldo anterior: local 1.00 vs proveedor 0.90"],
  local: { installment: 2, last_balance: 1, amount: 1, taxes: [{ type: "IVA", rate: 0.16, base: 0.862069, withholding: false }] },
  proveedor: { installment: 2, last_balance: 0.9, amount: 1, currency: "USD", taxes: null },
};

describe("REP summary diagnostic", () => {
  it("preserves exact amounts/nulls through HTTP422, extraction and both copy formats", async () => {
    const original = new Response(JSON.stringify(body), { status: 422 });
    const transport = { context: original, message: "Edge Function returned a non-2xx status code" };
    const parsed = await parseFunctionError(transport);
    const error = toReadableError(transport, parsed, "Fallback");
    expect(error.message).toBe(body.message);
    expect(original.bodyUsed).toBe(false);
    const details = extractErrorDetails(error);
    expect(details.detallesSat?.resumenRep).toEqual(diagnosticoResumenRep(body));
    expect(details.detallesSat?.resumenRep).toMatchObject({ local: { taxes: [{ base: 0.862069 }] }, proveedor: { taxes: null } });
    const report = { errorDetails: details, user: {}, client: {} } as ErrorReport;
    expect(JSON.parse(formatReportJson(report)).errorDetails.detallesSat.resumenRep.proveedor.last_balance).toBe(0.9);
    expect(formatReportMarkdown(report)).toContain('"resumenRep"');
    expect(formatReportMarkdown(report)).toContain('"base": 0.862069');
  });

  it("excludes root, summary and tax metadata instead of copying the raw provider body", () => {
    const diagnostic = diagnosticoResumenRep({
      ...body, authorization: "fixture-credential", rfc: "fixture-rfc", email: "fixture-email", raw: "fixture-raw",
      local: { ...body.local, uuid: "fixture-uuid", email: "fixture-email", taxes: [{ ...body.local.taxes[0], secret: "fixture-secret", raw: "fixture-tax" }] },
      proveedor: { ...body.proveedor, uuid: "fixture-provider-uuid", total: 123, api_key: "fixture-key" },
    });
    expect(diagnostic).toEqual(diagnosticoResumenRep(body));
    expect(JSON.stringify(diagnostic)).not.toContain("fixture-");
  });

  it("does not invent values for absent or null fields", () => {
    expect(diagnosticoResumenRep({ error: body.error, proveedor: { installment: null, last_balance: null, amount: null, currency: null, taxes: null } }))
      .toEqual({ proveedor: { installment: null, last_balance: null, amount: null, currency: null, taxes: null } });
  });

  it("ignores malformed numbers/objects and does not coerce numeric strings", () => {
    expect(diagnosticoResumenRep({ error: body.error, moneda: {}, tolerancia: Infinity, divergencias: ["valid", 123], local: [],
      proveedor: { installment: NaN, last_balance: "1.00", amount: {}, taxes: [null, { type: "UNRECOGNIZED", rate: Infinity, base: "0.1", withholding: "false" }] } }))
      .toEqual({ divergencias: ["valid"], proveedor: { taxes: [{ type: "UNRECOGNIZED" }] } });
  });

  it("does not attach REP diagnostics to other errors", () => {
    expect(diagnosticoResumenRep({ ...body, error: "validation_failed" })).toBeUndefined();
    expect(extractErrorDetails(toReadableError(null, { error: "other", message: "Other" }, "Fallback")).detallesSat?.resumenRep).toBeUndefined();
  });

  it("does not invoke diagnostic accessors", () => {
    const input = { error: body.error, get proveedor() { throw new Error("accessor executed"); } };
    expect(() => diagnosticoResumenRep(input)).not.toThrow();
    expect(diagnosticoResumenRep(input)).toEqual({});
  });

  it("filters original invalid types before they can become diagnostic strings", () => {
    expect(diagnosticoResumenRep({ error: body.error, moneda: NaN, divergencias: [Infinity, NaN, () => "function", Symbol("symbol"), 10n, "valid"],
      proveedor: { currency: 10n, taxes: [{ type: Infinity, rate: 0.16, base: 1 }, { type: () => "IVA" }, { type: {} }, []] } }))
      .toEqual({ divergencias: ["valid"], proveedor: { taxes: [{ rate: 0.16, base: 1 }] } });
    for (const invalid of [Infinity, NaN, () => "USD", Symbol("USD"), 10n, new String("USD"), new Date(0)]) {
      expect(diagnosticoResumenRep({ error: body.error, moneda: invalid, proveedor: { currency: invalid, taxes: [{ type: invalid }] } }))
        .toEqual({ proveedor: { taxes: [] } });
    }
  });

  it("never reads getters in selected properties, nested taxes or array indices", () => {
    let accesses = 0;
    const divergencias = ["valid", "placeholder"];
    Object.defineProperty(divergencias, "1", { get: () => { accesses += 1; return "getter text"; } });
    const tax = { base: 1, get type() { accesses += 1; return "IVA"; } };
    const taxes = [tax, {}];
    Object.defineProperty(taxes, "1", { get: () => { accesses += 1; return { type: "IVA" }; } });
    const diagnostic = diagnosticoResumenRep({ error: body.error, divergencias,
      get moneda() { accesses += 1; return "USD"; }, proveedor: { taxes } });
    expect(accesses).toBe(0);
    expect(diagnostic).toEqual({ divergencias: ["valid"], proveedor: { taxes: [{ base: 1 }] } });
  });

  it.each([100, 101])("retains explicit truncation of %i divergences and taxes through extraction and both copies", (total) => {
    const divergencias = Array.from({ length: total }, (_, index) => `Divergence ${index}`);
    const taxes = Array.from({ length: total }, (_, index) => ({ type: "IVA", rate: 0.16, base: index + 0.125 }));
    const diagnostic = diagnosticoResumenRep({ ...body, divergencias, proveedor: { ...body.proveedor, taxes } });
    const included = total > 100 ? 99 : total;
    const marker = { __diagnosticTruncation: { kind: "array", total, included, omitted: total - included } };
    const expectedDivergences = total > 100 ? [...divergencias.slice(0, included), marker] : divergencias;
    const expectedTaxes = total > 100 ? [...taxes.slice(0, included), marker] : taxes;
    expect(diagnostic?.divergencias).toEqual(expectedDivergences);
    expect(diagnostic?.proveedor).toMatchObject({ taxes: expectedTaxes });
    const responseBody = { ...body, divergencias, proveedor: { ...body.proveedor, taxes } };
    const error = toReadableError(null, responseBody, "Fallback");
    const details = extractErrorDetails(error);
    expect(details.detallesSat?.resumenRep).toEqual(diagnostic);
    const report = { errorDetails: details, user: {}, client: {} } as ErrorReport;
    const copied = JSON.parse(formatReportJson(report)).errorDetails.detallesSat.resumenRep;
    expect(copied.divergencias).toEqual(expectedDivergences);
    expect(copied.proveedor.taxes).toEqual(expectedTaxes);
    expect(copied.proveedor.taxes).not.toContainEqual({});
    const markdown = formatReportMarkdown(report);
    if (total > 100) {
      expect(markdown).toContain('"__diagnosticTruncation"');
      expect(markdown).toContain('"total": 101');
      expect(markdown).toContain('"included": 99');
      expect(markdown).toContain('"omitted": 2');
    } else expect(markdown).not.toContain('"__diagnosticTruncation"');
  });

  it("keeps allowed fields located after more than 99 unrelated properties", () => {
    const unrelated = Object.fromEntries(Array.from({ length: 110 }, (_, index) => [`unrelated${index}`, index]));
    expect(diagnosticoResumenRep({ ...unrelated, error: body.error, moneda: "USD", tolerancia: 0.01,
      local: { ...unrelated, installment: 2, last_balance: 1, amount: 1 },
      proveedor: { ...unrelated, currency: "USD", taxes: [{ ...unrelated, type: "IVA", rate: 0.16, base: 1 }] } }))
      .toEqual({ moneda: "USD", tolerancia: 0.01, local: { installment: 2, last_balance: 1, amount: 1 },
        proveedor: { currency: "USD", taxes: [{ type: "IVA", rate: 0.16, base: 1 }] } });
  });
});
