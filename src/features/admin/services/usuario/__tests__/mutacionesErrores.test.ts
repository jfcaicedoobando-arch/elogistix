/**
 * Cobertura del lector de motivo real de errores de `user-management`.
 */
import { describe, it, expect } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { errorDeEdgeFunction, traducirMensajeEdge } from "../mutaciones.errores";

function httpError(body: string): FunctionsHttpError {
  return new FunctionsHttpError(new Response(body, { status: 400 }));
}

describe("errorDeEdgeFunction", () => {
  it("traduce el rechazo de correo inválido del proveedor de identidad", async () => {
    const err = await errorDeEdgeFunction(
      httpError(JSON.stringify({ error: "Unable to validate email address: invalid format" })),
      "fallback",
    );
    expect(err.message).toContain("no tiene un formato válido");
  });

  it("propaga el motivo real cuando no hay traducción", async () => {
    const err = await errorDeEdgeFunction(
      httpError(JSON.stringify({ error: "Organización destino no encontrada" })),
      "fallback",
    );
    expect(err.message).toBe("Organización destino no encontrada");
  });

  it("usa el fallback cuando el cuerpo es HTML de gateway", async () => {
    const err = await errorDeEdgeFunction(httpError("<!DOCTYPE html><html>522</html>"), "fallback");
    expect(err.message).toBe("fallback");
  });

  it("usa el fallback con el mensaje genérico de non-2xx", async () => {
    const err = await errorDeEdgeFunction(
      new Error("Edge Function returned a non-2xx status code"),
      "fallback",
    );
    expect(err.message).toBe("fallback");
  });

  it("conserva mensajes específicos que no son genéricos", async () => {
    const err = await errorDeEdgeFunction(new Error("Sin sesión activa"), "fallback");
    expect(err.message).toBe("Sin sesión activa");
  });
});

describe("traducirMensajeEdge", () => {
  it("traduce límite de intentos", () => {
    expect(traducirMensajeEdge("Rate limit exceeded")).toContain("Demasiados intentos");
  });
});
