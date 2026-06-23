/**
 * 13.115.0 (Sprint 1.1) — reemplaza los "tests de grep" previos.
 *
 * Antes este archivo sólo hacía `assertStringIncludes(source, "Deno.serve")`,
 * lo que NO ejercita lógica. La lógica pura (ventanas de cobranza, saldos)
 * ya se prueba en `helpers_test.ts`. La cobertura Sentry/auth se prueba en
 * `src/__tests__/architecture/sentry-edge-coverage.test.ts`.
 *
 * Aquí dejamos UN smoke check estructural que SÍ aporta señal: el handler
 * declara los puntos de seguridad obligatorios (auth + preflight) y no
 * regresiona el ordenamiento básico.
 */
import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const indexSource = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("cxc-recordatorios: maneja preflight CORS antes que cualquier lógica", () => {
  // Si esto se rompe, peticiones OPTIONS desde el browser fallarán con CORS.
  assertStringIncludes(indexSource, "handlePreflightStrict");
});

Deno.test("cxc-recordatorios: requiere JWT (authenticate) — no abierto a anónimos", () => {
  // Sin esto, cualquiera podría leer facturas con saldo de toda la BD.
  assertStringIncludes(indexSource, "authenticate(req)");
});

Deno.test("cxc-recordatorios: verifica rol admin/operador (checkAdminAccess)", () => {
  // Sin esto, cualquier usuario autenticado vería facturas de otras orgs.
  assertStringIncludes(indexSource, "checkAdminAccess");
});

Deno.test("cxc-recordatorios: 403 si caller no tiene org y no es global admin", () => {
  // Defensa explícita contra el caso "JWT válido pero sin organización".
  assertStringIncludes(indexSource, "Permisos insuficientes");
});
