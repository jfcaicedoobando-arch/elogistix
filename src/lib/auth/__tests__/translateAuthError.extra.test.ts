import { describe, it, expect } from "vitest";
import { translateAuthError } from "@/lib/auth/translateAuthError";

describe("translateAuthError · valores nulos / vacíos", () => {
  it("retorna mensaje genérico cuando recibe undefined", () => {
    expect(translateAuthError(undefined)).toBe(
      "Ocurrió un error inesperado. Intenta de nuevo.",
    );
  });

  it("retorna mensaje genérico cuando recibe null", () => {
    expect(translateAuthError(null)).toBe(
      "Ocurrió un error inesperado. Intenta de nuevo.",
    );
  });

  it("retorna mensaje genérico cuando recibe cadena vacía", () => {
    expect(translateAuthError("")).toBe(
      "Ocurrió un error inesperado. Intenta de nuevo.",
    );
  });
});

describe("translateAuthError · credenciales inválidas", () => {
  it("traduce 'invalid login credentials'", () => {
    expect(translateAuthError("Invalid login credentials")).toBe(
      "Email o contraseña incorrectos. Verifica tus datos e intenta de nuevo.",
    );
  });

  it("traduce 'invalid_credentials'", () => {
    expect(translateAuthError("invalid_credentials")).toBe(
      "Email o contraseña incorrectos. Verifica tus datos e intenta de nuevo.",
    );
  });

  it("es insensible a mayúsculas en credenciales", () => {
    expect(translateAuthError("INVALID LOGIN CREDENTIALS")).toBe(
      "Email o contraseña incorrectos. Verifica tus datos e intenta de nuevo.",
    );
  });
});

describe("translateAuthError · email no confirmado", () => {
  it("traduce 'email not confirmed'", () => {
    expect(translateAuthError("Email not confirmed")).toBe(
      "Tu cuenta aún no está confirmada. Revisa tu correo y abre el enlace de activación.",
    );
  });
});

describe("translateAuthError · usuario ya registrado", () => {
  it("traduce 'user already registered'", () => {
    expect(translateAuthError("User already registered")).toBe(
      "Este email ya está registrado. Inicia sesión o recupera tu contraseña.",
    );
  });

  it("traduce 'already registered' (variante corta)", () => {
    expect(translateAuthError("already registered")).toBe(
      "Este email ya está registrado. Inicia sesión o recupera tu contraseña.",
    );
  });
});

describe("translateAuthError · contraseña", () => {
  it("traduce 'password should be at least'", () => {
    expect(translateAuthError("Password should be at least 6 characters")).toBe(
      "La contraseña debe tener al menos 6 caracteres.",
    );
  });

  it("traduce 'new password should be different'", () => {
    expect(translateAuthError("New password should be different from the old password")).toBe(
      "La nueva contraseña debe ser diferente a la actual.",
    );
  });
});

describe("translateAuthError · rate limit / red", () => {
  it("traduce 'rate limit'", () => {
    expect(translateAuthError("rate limit exceeded")).toBe(
      "Demasiados intentos. Espera unos minutos antes de volver a intentar.",
    );
  });

  it("traduce 'too many requests'", () => {
    expect(translateAuthError("Too many requests")).toBe(
      "Demasiados intentos. Espera unos minutos antes de volver a intentar.",
    );
  });

  it("traduce 'failed to fetch'", () => {
    expect(translateAuthError("Failed to fetch")).toBe(
      "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.",
    );
  });

  it("traduce 'network error'", () => {
    expect(translateAuthError("Network error occurred")).toBe(
      "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.",
    );
  });
});

describe("translateAuthError · token y usuario", () => {
  it("traduce 'token has expired'", () => {
    expect(translateAuthError("token has expired")).toBe(
      "El enlace expiró o no es válido. Solicita uno nuevo.",
    );
  });

  it("traduce 'invalid token'", () => {
    expect(translateAuthError("invalid token provided")).toBe(
      "El enlace expiró o no es válido. Solicita uno nuevo.",
    );
  });

  it("traduce 'user not found'", () => {
    expect(translateAuthError("user not found")).toBe(
      "No existe una cuenta con ese email.",
    );
  });

  it("devuelve el mensaje original si no hay traducción", () => {
    const msg = "Unexpected server error 500";
    expect(translateAuthError(msg)).toBe(msg);
  });
});
