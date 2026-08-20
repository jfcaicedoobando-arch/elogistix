/**
 * Ola de accesibilidad · candado del atributo nativo `title=`.
 *
 * El `title` del navegador no es accesible: no existe en táctil, casi nunca se
 * muestra con foco de teclado y los lectores de pantalla lo duplican o lo
 * ignoran. La app usa la primitiva `Hint` (`src/components/shared/Hint.tsx`),
 * que muestra un Tooltip de Radix visible con hover y con foco, y deja el
 * nombre accesible en `aria-label`.
 *
 * Este test cuenta sólo los `title=` que llegan al DOM: etiquetas nativas y
 * componentes que reenvían props al DOM. Los `title` que son props de
 * componentes propios (PageHeader, FormDialogShell, DetailHeader…) no cuentan.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { sync as globSync } from "fast-glob";

/** Componentes shadcn/base que reenvían `title` al elemento DOM. */
const REENVIAN_AL_DOM = [
  "Button", "Badge", "TableCell", "TableRow", "TableHead", "DetailTableHead",
  "Input", "Label", "Progress", "Avatar", "AvatarImage", "Textarea", "Checkbox",
];

/**
 * Excepción documentada: en `<object>` el `title` es parte de la semántica del
 * documento embebido (nombre accesible del marco), no un tooltip.
 */
const ALLOWLIST = new Set(["src/components/shared/PdfObjectViewer.tsx"]);

const RE_TAG = /<([A-Za-z][\w.]*)((?:[^<>{}]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*?)\/?>/gs;

function contarTitleNativo(): { total: number; porArchivo: Record<string, number> } {
  const archivos = globSync("src/**/*.tsx", {
    ignore: ["**/__tests__/**", "**/*.test.tsx", "src/test/**"],
  });
  const porArchivo: Record<string, number> = {};
  let total = 0;
  for (const archivo of archivos) {
    if (ALLOWLIST.has(archivo)) continue;
    const contenido = readFileSync(archivo, "utf8");
    let ocurrencias = 0;
    for (const m of contenido.matchAll(RE_TAG)) {
      const [, tag, attrs] = m;
      if (!/(^|\s)title=/.test(attrs)) continue;
      const esDom = tag[0] === tag[0].toLowerCase() || REENVIAN_AL_DOM.includes(tag);
      if (esDom) ocurrencias += 1;
    }
    if (ocurrencias > 0) {
      porArchivo[archivo] = ocurrencias;
      total += ocurrencias;
    }
  }
  return { total, porArchivo };
}

describe("arquitectura · sin atributo title nativo", () => {
  it("no usa `title=` en elementos del DOM (usa <Hint label=…> + aria-label)", () => {
    const { total, porArchivo } = contarTitleNativo();
    expect(
      total,
      `Se detectaron ${total} atributos \`title\` nativos. Migra a ` +
        `<Hint label="…"> (src/components/shared/Hint.tsx) y deja el nombre ` +
        `accesible en aria-label. Archivos: ${JSON.stringify(porArchivo, null, 2)}`,
    ).toBe(0);
  });
});
