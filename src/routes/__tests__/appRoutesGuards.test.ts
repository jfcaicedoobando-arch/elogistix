import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RUTAS_LIBRES, ROLE_ROUTE_MATRIX } from "@/lib/access/roleRouteMatrix";

/**
 * M11 (Ola 4) — Defensa en profundidad: toda ruta de negocio declarada en
 * `appRoutes.tsx` debe envolverse en `guarded(...)` (que aplica
 * `ProtectedRoute allowedRoles`) salvo que sea una ruta libre. La matriz de
 * rutas sola no basta: sólo la consume el sidebar.
 */
const fuente = readFileSync("src/routes/appRoutes.tsx", "utf8");
const RUTAS_DEV_EXENTAS = ["/dev/pdf-preview/cotizacion/:id"];

/** Extrae pares `path` → snippet del `element` de cada <Route>. */
function rutas(): { path: string; element: string }[] {
  const re = /<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g;
  const out: { path: string; element: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(fuente)) !== null) out.push({ path: m[1]!, element: m[2]! });
  return out;
}

describe("appRoutes · guards explícitos por ruta", () => {
  const todas = rutas();

  it("encuentra rutas para auditar", () => {
    expect(todas.length).toBeGreaterThan(30);
  });

  it("toda ruta no libre está envuelta en guarded(...)", () => {
    const sinGuard = todas
      .filter(({ path }) => !RUTAS_LIBRES.includes(path) && !RUTAS_DEV_EXENTAS.includes(path))
      .filter(({ element }) => !element.includes("guarded("))
      .map(({ path }) => path);
    expect(sinGuard).toEqual([]);
  });

  it("las rutas base con guard también existen en la matriz de roles", () => {
    const faltantes = todas
      .filter(({ path }) => !path.includes(":") && !RUTAS_LIBRES.includes(path))
      .filter(({ path }) => !RUTAS_DEV_EXENTAS.includes(path))
      .filter(({ path }) => !(path in ROLE_ROUTE_MATRIX))
      .map(({ path }) => path);
    expect(faltantes).toEqual([]);
  });
});
