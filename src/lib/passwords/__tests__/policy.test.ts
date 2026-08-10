import { describe, it, expect } from "vitest";
import {
  PASSWORD_MIN,
  PASSWORD_MAX,
  passwordSchema,
  validarPassword,
} from "../policy";

describe("política de contraseñas (Ola 8 · B2)", () => {
  it("exige al menos 10 caracteres", () => {
    expect(PASSWORD_MIN).toBe(10);
    expect(validarPassword("Abc12345!")).toMatch(/al menos 10 caracteres/);
    expect(validarPassword("Abc12345!x")).toBeNull();
  });

  it("rechaza contraseñas más largas que el límite de Auth", () => {
    expect(validarPassword("a".repeat(PASSWORD_MAX))).toBeNull();
    expect(validarPassword("a".repeat(PASSWORD_MAX + 1))).toMatch(/no puede exceder/);
  });

  it("el schema zod aplica el mismo mínimo y máximo", () => {
    expect(passwordSchema.safeParse("corta1!").success).toBe(false);
    expect(passwordSchema.safeParse("SuperSegura9!").success).toBe(true);
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MAX + 1)).success).toBe(false);
  });

  it("los mensajes de error están en español", () => {
    const res = passwordSchema.safeParse("123");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe(
        "La contraseña debe tener al menos 10 caracteres.",
      );
    }
  });
});
