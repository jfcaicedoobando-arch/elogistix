// @vitest-environment node
/**
 * Declaración explícita de entorno en archivos de test (P2 auditoría stack).
 *
 * Analogía: antes la puerta de entrada se elegía adivinando por la ropa del
 * visitante (heurística de marcadores); ahora quien lo necesita puede traer su
 * pase escrito (`// @vitest-environment jsdom`) y ese pase manda.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { entornoDeclarado, splitTestsByEnvironment } from "../../../scripts/lib/testEnvSplit";

describe("entornoDeclarado", () => {
  it("lee jsdom y node del docblock estándar de Vitest", () => {
    expect(entornoDeclarado("// @vitest-environment jsdom\n")).toBe("jsdom");
    expect(entornoDeclarado("/** @vitest-environment node */\n")).toBe("node");
  });

  it("devuelve null cuando no hay declaración", () => {
    expect(entornoDeclarado("import { it } from 'vitest';\n")).toBeNull();
    expect(entornoDeclarado("// @vitest-environment happy-dom\n")).toBeNull();
  });
});

describe("splitTestsByEnvironment · la declaración gana sobre la heurística", () => {
  it("manda sobre la extensión y sobre los marcadores de DOM", () => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "envsplit-"));
    const src = path.join(raiz, "src");
    fs.mkdirSync(src, { recursive: true });
    // .ts sin marcadores de DOM, pero declara jsdom → jsdom.
    fs.writeFileSync(path.join(src, "a.test.ts"), "// @vitest-environment jsdom\nexport {};\n");
    // .tsx (iría a jsdom por extensión), pero declara node → node.
    fs.writeFileSync(path.join(src, "b.test.tsx"), "// @vitest-environment node\nexport {};\n");
    // .ts sin declaración y sin marcadores → node (heurística intacta).
    fs.writeFileSync(path.join(src, "c.test.ts"), "export {};\n");
    // .ts sin declaración con marcador de DOM → jsdom (heurística intacta).
    fs.writeFileSync(path.join(src, "d.test.ts"), "document.body.textContent;\n");

    const split = splitTestsByEnvironment(raiz);
    expect(split.jsdom).toContain("src/a.test.ts");
    expect(split.node).toContain("src/b.test.tsx");
    expect(split.node).toContain("src/c.test.ts");
    expect(split.jsdom).toContain("src/d.test.ts");

    fs.rmSync(raiz, { recursive: true, force: true });
  });
});
