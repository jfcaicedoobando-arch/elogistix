/**
 * A2 — regresión estática: ninguna ruta de escritura debe volver a tomar la
 * organización de `useAuth()` (NULL para el super admin de plataforma).
 * Se permite sólo en la lista blanca de archivos que no escriben datos.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PERMITIDOS = new Set<string>([
  // Contextos que definen la fuente de verdad.
  "src/lib/contexts/AuthContext.tsx",
  "src/lib/contexts/OrganizationContext.tsx",
  // Observabilidad: etiqueta el org de la sesión, no escribe datos de negocio.
  "src/lib/observability/hooks/useSyncSentryErrorContext.ts",
]);

function archivosFuente(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      archivosFuente(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("A2 · organización activa desde una sola fuente", () => {
  it("nadie fuera de la lista blanca lee organizationId de useAuth()", () => {
    const infractores = archivosFuente("src").filter((file) => {
      if (PERMITIDOS.has(file.replace(/\\/g, "/"))) return false;
      const src = readFileSync(file, "utf8");
      if (!src.includes("useAuth(")) return false;
      const destructuring = src.match(/const \{[^}]*\} = useAuth\(\)/g) ?? [];
      const directo = src.includes("useAuth().organizationId");
      return directo || destructuring.some((d) => d.includes("organizationId"));
    });

    expect(
      infractores,
      "Usa `useOrgActiva()` (src/hooks/shared/useOrgActiva.ts) en lugar de `useAuth().organizationId`",
    ).toEqual([]);
  });
});
