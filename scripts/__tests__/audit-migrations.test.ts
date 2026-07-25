import { describe, it, expect } from "vitest";
import { FNAME_RE } from "../audit-migrations";

describe("audit-migrations · FNAME_RE", () => {
  it("acepta snake_case (guiones bajos) en el sufijo — patrón QW7", () => {
    expect(
      FNAME_RE.test("20260725080000_qw7_cxp_por_pagar_fecha_programada.sql"),
    ).toBe(true);
  });

  it("acepta el patrón uuid tradicional generado por la plataforma", () => {
    expect(
      FNAME_RE.test("20260725172648_c2e8e649-e251-4054-a187-64b6dce465e4.sql"),
    ).toBe(true);
  });

  it("acepta guiones intermedios (patrón `fix-…`)", () => {
    expect(FNAME_RE.test("20260724130000_fix-aging-nc-deleted-at.sql")).toBe(true);
  });

  it("rechaza espacios en el nombre", () => {
    expect(FNAME_RE.test("20260725080000_bad name.sql")).toBe(false);
  });

  it("rechaza mayúsculas", () => {
    expect(FNAME_RE.test("20260725080000_BadName.sql")).toBe(false);
  });

  it("rechaza timestamp incorrecto", () => {
    expect(FNAME_RE.test("2026-07-25_valid_name.sql")).toBe(false);
  });
});
