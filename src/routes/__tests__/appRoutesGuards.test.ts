import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RUTAS_LIBRES, ROLE_ROUTE_MATRIX } from "@/lib/access/roleRouteMatrix";

/**
 * M11 (Ola 4) — Defensa en profundidad: toda ruta de negocio declarada en
 * `appRoutes.tsx` debe envolverse en `guarded(...)` (que aplica
 * `ProtectedRoute allowedRoles`) salvo que sea una ruta libre.
 *
 * Paso 13 de la auditoría — `guarded` ya no recibe arrays de roles sino la
 * CLAVE de ruta: la política sale de `ROLE_ROUTE_MATRIX`. Estas pruebas
 * impiden el drift: la clave del guard debe ser exactamente el `path` de su
 * `<Route>` y debe existir en la matriz. Así no hay forma de declarar un guard
 * con una política distinta a la canónica.
 */
const fuente = readFileSync("src/routes/appRoutes.tsx", "utf8");

/** Extrae pares `path` → snippet del `element` de cada <Route>. */
function rutas(): { path: string; element: string }[] {
  const re = /<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g;
  const out: { path: string; element: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(fuente)) !== null) out.push({ path: m[1]!, element: m[2]! });
  return out;
}

/** Clave de acceso pasada a `guarded("...")`, o `null` si no hay guard. */
function claveDeGuard(element: string): string | null {
  return /guarded\("([^"]+)"/.exec(element)?.[1] ?? null;
}

describe("appRoutes · guards explícitos por ruta", () => {
  const todas = rutas();

  it("encuentra rutas para auditar", () => {
    expect(todas.length).toBeGreaterThan(30);
  });

  /** Redirecciones puras: no renderizan datos, sólo navegan. */
  const esRedirect = (element: string) =>
    element.includes("RedirectPreserveSearch") || element.includes("<Navigate");

  it("toda ruta no libre está envuelta en guarded(...)", () => {
    const sinGuard = todas
      .filter(({ path }) => !RUTAS_LIBRES.includes(path))
      .filter(({ element }) => !esRedirect(element) && !element.includes("guarded("))
      .map(({ path }) => path);
    expect(sinGuard).toEqual([]);
  });

  it("el router no declara arrays de roles: sólo claves de la matriz", () => {
    expect(fuente).not.toMatch(/guarded\(\s*[A-Z_]+\s*,/);
    expect(fuente).not.toMatch(/_ROLES/);
  });

  it("la clave del guard coincide exactamente con el path de su Route", () => {
    const desalineadas = todas
      .map(({ path, element }) => ({ path, clave: claveDeGuard(element) }))
      .filter(({ clave }) => clave !== null)
      .filter(({ path, clave }) => clave !== path);
    expect(desalineadas).toEqual([]);
  });

  it("toda clave usada por un guard existe en la matriz de roles", () => {
    const faltantes = todas
      .map(({ element }) => claveDeGuard(element))
      .filter((clave): clave is string => clave !== null)
      .filter((clave) => !(clave in ROLE_ROUTE_MATRIX));
    expect(faltantes).toEqual([]);
  });

  it("incluye las rutas dinámicas protegidas dentro de la matriz", () => {
    for (const dinamica of [
      "/embarques/:id",
      "/embarques/:id/editar",
      "/facturacion/:id",
      "/proformas/:id",
      "/compras/facturas/:id",
      "/compras/proveedores/:id",
      "/proveedores/:id",
      "/clientes/:id",
      "/clientes/:clienteId/estado-de-cuenta",
      "/cotizaciones/:id",
      "/cotizaciones/:id/editar",
    ]) {
      expect(dinamica in ROLE_ROUTE_MATRIX).toBe(true);
    }
  });
});
