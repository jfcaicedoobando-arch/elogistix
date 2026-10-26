/** Sentry 8C/8G: avisos de captura del usuario no se reportan y se explican en español. */
import { describe, expect, it } from "vitest";
import { isExpectedTelemetryError } from "../expectedTelemetryError";
import { mensajeConstraintUnico } from "@/lib/errors/pgConstraintMessages";
import { ReglaNegocioError } from "@/lib/errors/reglaNegocio";

const CONTENEDOR = 'duplicate key value violates unique constraint "contenedores_numero_unico"';

describe("contenedor repetido (8C)", () => {
  it("muestra el mensaje del contenedor", () => {
    expect(mensajeConstraintUnico(CONTENEDOR)).toBe(
      "Ese número de contenedor ya está registrado en otro embarque activo. Verifica el número capturado.",
    );
  });
  it("no llega a Sentry", () => {
    expect(isExpectedTelemetryError({ code: "23505", message: CONTENEDOR })).toBe(true);
  });
  it("otro duplicado sin aviso propio sí se reporta", () => {
    expect(isExpectedTelemetryError({ code: "23505", message: 'duplicate key value violates unique constraint "otra_tabla_unica"' })).toBe(false);
  });
});

describe("correo repetido (8G)", () => {
  it("ReglaNegocioError no llega a Sentry", () => {
    expect(isExpectedTelemetryError(new ReglaNegocioError("Ya existe un usuario con el correo a@b.mx en esta organización."))).toBe(true);
  });
});
