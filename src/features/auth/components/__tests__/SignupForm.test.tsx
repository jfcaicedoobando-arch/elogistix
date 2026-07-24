import { describe, it, expect } from "vitest";
import { getFirstFieldError } from "../SignupForm";

/**
 * v13.312.22 — blindaje del helper extraído para bajar complejidad de SignupForm.
 * El componente en sí ya está cubierto por la validación en el flujo dev.
 */
describe("SignupForm.getFirstFieldError — orden canónico de campos", () => {
  it("retorna null cuando no hay errores", () => {
    expect(getFirstFieldError({})).toBeNull();
  });

  it("retorna el primer error en orden (name gana sobre email)", () => {
    const errors = {
      name: { message: "Ingresa tu nombre." },
      email: { message: "Correo inválido." },
    };
    expect(getFirstFieldError(errors)).toBe("Ingresa tu nombre.");
  });

  it("company gana sobre password cuando name está limpio", () => {
    const errors = {
      company: { message: "Empresa muy corta." },
      password: { message: "Mínimo 6 caracteres." },
    };
    expect(getFirstFieldError(errors)).toBe("Empresa muy corta.");
  });

  it("acceptTerms se reporta como último cuando el resto está limpio", () => {
    const errors = {
      acceptTerms: { message: "Debes aceptar los términos." },
    };
    expect(getFirstFieldError(errors)).toBe("Debes aceptar los términos.");
  });

  it("ignora campos con message vacío/undefined", () => {
    const errors = {
      name: undefined,
      company: { message: "" },
      email: { message: "Correo inválido." },
    };
    expect(getFirstFieldError(errors)).toBe("Correo inválido.");
  });
});
