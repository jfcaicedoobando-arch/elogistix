/**
 * Ola 13 · R4EF-01/R4EF-02 — el catálogo nunca propaga texto crudo al cliente.
 * Run: deno test --no-check supabase/functions/user-management/errores_test.ts
 */
// @ts-nocheck — Deno runtime.
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { esCorreoDuplicado, mensajeSeguro, MENSAJE_CORREO_NO_DISPONIBLE } from "./errores.ts";

Deno.test("R4EF-01: error de Postgres no filtra nombres de constraint", () => {
  const crudo = 'duplicate key value violates unique constraint "organization_members_pkey"';
  const seguro = mensajeSeguro(crudo);
  assert(!seguro.includes("organization_members"));
  assert(!seguro.includes("duplicate key"));
  assertStringIncludes(seguro, "LC_USUARIO_CONFLICTO_REGISTRO:");
});

Deno.test("R4EF-01: mensaje desconocido cae en el genérico o fallback, nunca el crudo", () => {
  const crudo = "some unexpected GoTrue detail with schema auth.users";
  assert(!mensajeSeguro(crudo).includes("auth.users"));
  assertStringIncludes(mensajeSeguro(crudo), "LC_USUARIO_ERROR_INTERNO:");
  assertEquals(mensajeSeguro(crudo, "FALLBACK_ES"), "FALLBACK_ES");
});

Deno.test("R4EF-01: correo inválido, password y rate limit tienen mensaje catalogado", () => {
  assertStringIncludes(
    mensajeSeguro("Unable to validate email address: invalid format"),
    "LC_USUARIO_EMAIL_INVALIDO:",
  );
  assertStringIncludes(mensajeSeguro("email rate limit exceeded"), "LC_USUARIO_DEMASIADOS_INTENTOS:");
  assertStringIncludes(
    mensajeSeguro("Password should be at least 6 characters"),
    "LC_USUARIO_PASSWORD_RECHAZADA:",
  );
});

Deno.test("R4EF-01: null/vacío devuelve fallback o genérico", () => {
  assertStringIncludes(mensajeSeguro(null), "LC_USUARIO_ERROR_INTERNO:");
  assertEquals(mensajeSeguro("   ", "FALLBACK_ES"), "FALLBACK_ES");
});

Deno.test("R4EF-02: el 409 genérico no hace eco del correo ni confirma existencia", () => {
  assert(!MENSAJE_CORREO_NO_DISPONIBLE.includes("@"));
  assertStringIncludes(MENSAJE_CORREO_NO_DISPONIBLE, "LC_USUARIO_CORREO_NO_DISPONIBLE:");
});

Deno.test("R4EF-02: esCorreoDuplicado reconoce las variantes de GoTrue", () => {
  for (const m of ["User already registered", "email already exists", "Duplicate entry"]) {
    assertEquals(esCorreoDuplicado(m), true, m);
  }
  assertEquals(esCorreoDuplicado("Unable to validate email address"), false);
  assertEquals(esCorreoDuplicado(undefined), false);
});
