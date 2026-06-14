import { describe, expect, it } from "vitest";
import {
  parseConfigSafe,
  plataformaConfigSchema,
  seguridadConfigSchema,
} from "../configSchemas";

describe("seguridadConfigSchema", () => {
  it("parsea valores válidos", () => {
    const r = seguridadConfigSchema.parse({
      auto_confirmar_email: true,
      longitud_minima_password: 10,
      expiracion_sesion_horas: 48,
      max_intentos_login: 7,
      permitir_registro_publico: true,
    });
    expect(r.longitud_minima_password).toBe(10);
    expect(r.auto_confirmar_email).toBe(true);
  });

  it("parseConfigSafe aplica defaults si hay tipo inválido", () => {
    const r = parseConfigSafe(seguridadConfigSchema, {
      longitud_minima_password: "no-es-numero" as unknown as number,
    });
    expect(r.longitud_minima_password).toBe(8);
    expect(r.auto_confirmar_email).toBe(false);
    expect(r.max_intentos_login).toBe(5);
  });
});

describe("plataformaConfigSchema", () => {
  it("parsea email_soporte string", () => {
    const r = plataformaConfigSchema.parse({ email_soporte: "x@y.com" });
    expect(r.email_soporte).toBe("x@y.com");
  });

  it("default vacío cuando falta", () => {
    const r = parseConfigSafe(plataformaConfigSchema, {});
    expect(r.email_soporte).toBe("");
  });
});
