/**
 * Tests del traductor de errores de Supabase Auth.
 * Verifica que cada patrón conocido se mapea al mensaje localizado en es-MX
 * y que el fallback respeta el mensaje original.
 */
import { describe, it, expect } from "vitest";
import { translateAuthError } from "../translateAuthError";

describe("translateAuthError", () => {
  it("retorna mensaje genérico cuando recibe null/undefined/empty", () => {
    expect(translateAuthError(null)).toMatch(/inesperado/i);
    expect(translateAuthError(undefined)).toMatch(/inesperado/i);
    expect(translateAuthError("")).toMatch(/inesperado/i);
  });

  it.each([
    ["Invalid login credentials", /email o contraseña incorrectos/i],
    ["invalid_credentials", /email o contraseña incorrectos/i],
    ["Email not confirmed", /confirmada/i],
    ["User already registered", /ya está registrado/i],
    ["Password should be at least 6 characters", /al menos 6 caracteres/i],
    ["For security purposes, you can only request this after rate limit", /demasiados intentos/i],
    ["Too many requests", /demasiados intentos/i],
    ["Failed to fetch", /sin conexión/i],
    ["NetworkError when attempting to fetch", /sin conexión/i],
    ["User not found", /no existe una cuenta/i],
    ["New password should be different from the old password", /diferente a la actual/i],
    ["Token has expired", /enlace expiró/i],
    ["Invalid token format", /enlace expiró/i],
  ])("traduce %s", (input, expected) => {
    expect(translateAuthError(input)).toMatch(expected);
  });

  it("hace match insensible a mayúsculas/minúsculas", () => {
    expect(translateAuthError("INVALID LOGIN CREDENTIALS")).toMatch(/incorrectos/i);
  });

  it("devuelve el mensaje original cuando no hay match", () => {
    const raw = "Some other backend error xyz";
    expect(translateAuthError(raw)).toBe(raw);
  });
});
