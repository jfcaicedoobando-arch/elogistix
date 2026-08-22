/**
 * Guardrail de arquitectura — Encabezado de página canónico (V-09).
 *
 * Analogía: todas las oficinas del edificio usan el mismo letrero en la puerta.
 * El `<h1>` de una pantalla interna sólo puede nacer en `PageHeader` (listados y
 * wizards) o en `DetailHeader` (fichas de entidad). Si un archivo dibuja su
 * propio `<h1>` con la escala `text-display`, el alto del encabezado y la
 * separación del subtítulo dejan de coincidir con el resto del ERP.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Componentes canónicos y superficies públicas (login, legal, portal, marketing). */
const ALLOWLIST = [
  "src/components/shared/PageHeader.tsx",
  "src/components/shared/DetailHeader.tsx",
  "src/features/legal/components/LegalShell.tsx",
  "src/features/auth/components/AuthCard.tsx",
  "src/features/auth/routes/NotFound.tsx",
  "src/features/auth/routes/SinAcceso.tsx",
  "src/features/portal/components/PortalSinCliente.tsx",
  "src/features/portal/components/dashboard/PortalWelcomeCard.tsx",
];

/** Directorios fuera del alcance: PDF, marketing público y pruebas. */
const EXCLUIDOS = ["src/pdf", "src/generators", "src/features/marketing", "__tests__"];

function listarTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (EXCLUIDOS.some((ex) => full.includes(ex))) continue;
    if (entry.isDirectory()) out.push(...listarTsx(full));
    else if (entry.isFile() && entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("arquitectura: encabezado de página canónico", () => {
  const archivos = listarTsx("src").filter((f) => !ALLOWLIST.includes(f));

  it("encuentra archivos para auditar", () => {
    expect(archivos.length).toBeGreaterThan(100);
  });

  it("ninguna pantalla interna define su propio <h1>", () => {
    const infractores = archivos.filter((f) => /<h1[\s>]/.test(readFileSync(f, "utf8")));
    expect(
      infractores,
      `Estos archivos dibujan un <h1> propio. Usa <PageHeader> (listados/wizards) o <DetailHeader> (detalle):\n${infractores.join("\n")}`,
    ).toEqual([]);
  });
});
