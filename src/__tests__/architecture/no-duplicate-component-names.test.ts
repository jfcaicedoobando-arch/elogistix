/**
 * Anti-regresión (auditoría 2026-08-18 · punto 3).
 *
 * Dos componentes con el mismo nombre de archivo en features distintos son la
 * señal más común de lógica duplicada (pasó con `CartaGarantiaBadge`,
 * `OrgInfoCard`, `TabFacturacion` y `ActividadTimeline`). Si de verdad es el
 * mismo componente, va a `src/components/shared`; si son distintos, el nombre
 * debe decir de qué pantalla es.
 *
 * Sólo se revisan archivos `.tsx` PascalCase (componentes) fuera de `__tests__`.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const FEATURES_DIR = join(process.cwd(), "src", "features");

/**
 * Duplicados aceptados: son rutas de pantalla homónimas de módulos distintos
 * (`/admin/.../configuracion` y `/crm/configuracion`), no componentes que
 * compartan lógica.
 */
const PERMITIDOS = new Set<string>(["Configuracion.tsx"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry !== "__tests__") walk(p, out);
    } else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("arquitectura · nombres de componente únicos entre features", () => {
  it("no hay dos componentes con el mismo nombre de archivo", () => {
    const porNombre = new Map<string, string[]>();
    for (const file of walk(FEATURES_DIR)) {
      const nombre = basename(file);
      if (!/^[A-Z]/.test(nombre) || PERMITIDOS.has(nombre)) continue;
      const lista = porNombre.get(nombre) ?? [];
      lista.push(file.replace(`${process.cwd()}/`, ""));
      porNombre.set(nombre, lista);
    }
    const duplicados = [...porNombre.entries()]
      .filter(([, rutas]) => rutas.length > 1)
      .map(([nombre, rutas]) => `${nombre}\n  ${rutas.join("\n  ")}`);
    expect(
      duplicados,
      `Unifica en src/components/shared o renombra:\n${duplicados.join("\n")}`,
    ).toHaveLength(0);
  });
});
