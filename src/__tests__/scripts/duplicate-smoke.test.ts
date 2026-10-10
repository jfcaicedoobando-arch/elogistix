import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const script = resolve("scripts/ci/validate-duplicate-smoke.mjs");
const missing = { code: "P0002", message: "Cotización no encontrada" };
const validate = (status: number, input: string) => spawnSync(process.execPath,
  [script, String(status)], { input, encoding: "utf8" }).status;

describe("smoke de duplicar cotización: aceptación estricta", () => {
  it.each([0, 2])("acepta el error esperado con formato JSON %s", spaces => {
    expect(validate(404, JSON.stringify(missing, null, spaces))).toBe(0);
  });
  it.each([200, 204, 400, 401, 403, 429, 500, 502, 503])("rechaza HTTP %s incluso con código esperado", status => {
    expect(validate(status, JSON.stringify(missing))).toBe(1);
  });
  it.each(["PGRST202", "42501", "42703", "42883", "P0001"])("rechaza código %s", code => {
    expect(validate(404, JSON.stringify({ ...missing, code }))).toBe(1);
  });
  it.each(["<html>unavailable</html>", "", "null", "[]", "{}", '{"code":"P0002","message":"otro error"}'])("rechaza payload inesperado: %s", payload => {
    expect(validate(404, payload)).toBe(1);
  });
});
