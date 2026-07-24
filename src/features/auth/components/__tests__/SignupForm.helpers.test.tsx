import { describe, it, expect } from "vitest";
import { getFirstFieldError, SIGNUP_FIELD_ORDER } from "../SignupForm.helpers";

/**
 * v13.312.22 — blindaje del helper extraído para bajar complejidad de SignupForm.
 */
describe("SignupForm.getFirstFieldError — orden canónico de campos", () => {
  it("retorna null cuando no hay errores", () => {
    expect(getFirstFieldError({})).toBeNull();
  });

  it("retorna el primer error en orden (name gana sobre email)", () => {
    expect(
      getFirstFieldError({
        name: { message: "Ingresa tu nombre." },
        email: { message: "Correo inválido." },
      }),
    ).toBe("Ingresa tu nombre.");
  });

  it("company gana sobre password cuando name está limpio", () => {
    expect(
      getFirstFieldError({
        company: { message: "Empresa muy corta." },
        password: { message: "Mínimo 6 caracteres." },
      }),
    ).toBe("Empresa muy corta.");
  });

  it("acceptTerms se reporta como último cuando el resto está limpio", () => {
    expect(getFirstFieldError({ acceptTerms: { message: "Debes aceptar los términos." } })).toBe(
      "Debes aceptar los términos.",
    );
  });

  it("ignora campos con message vacío/undefined", () => {
    expect(
      getFirstFieldError({
        name: undefined,
        company: { message: "" },
        email: { message: "Correo inválido." },
      }),
    ).toBe("Correo inválido.");
  });

  it("SIGNUP_FIELD_ORDER preserva el contrato de 7 campos", () => {
    expect(SIGNUP_FIELD_ORDER).toEqual([
      "name",
      "company",
      "phone",
      "email",
      "password",
      "password2",
      "acceptTerms",
    ]);
  });
});
