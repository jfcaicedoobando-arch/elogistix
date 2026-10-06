/**
 * Contrato de los alias ESM exclusivos de Vitest. Si cambia el layout del
 * paquete, falla aquí antes de producir errores difusos de contexto.
 *
 * La primera etapa de preparación para Router 8 usa los especificadores
 * canónicos pero conserva Router 7 y el adaptador nuqs v7. No migra el modo
 * declarativo a Data Router ni afecta la resolución del build de producción.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { aliasVitest } from "../../../vitest.shared";
import { walk, relPath } from "../../../scripts/lib/walk";

const raiz = process.cwd();
const alias = aliasVitest(raiz);
const especificadoresRouter = [/^react-router$/, /^react-router\/dom$/];

function destino(patron: RegExp): string {
  const entrada = alias.find(
    (a) => a.find instanceof RegExp && a.find.source === patron.source,
  );
  if (!entrada) throw new Error(`Alias ausente para ${patron.source}`);
  return entrada.replacement;
}

describe("alias de React Router en Vitest · contrato con el paquete", () => {
  it("los dos archivos ESM aliaseados existen en node_modules", () => {
    for (const patron of especificadoresRouter) {
      const archivo = destino(patron);
      expect(fs.existsSync(archivo), `No existe ${archivo} (¿cambió el layout del paquete?)`).toBe(true);
    }
  });

  it("los destinos son módulos ESM (.mjs), no CJS", () => {
    for (const patron of especificadoresRouter) {
      expect(destino(patron).endsWith(".mjs")).toBe(true);
    }
  });

  it("conserva Router 7 y no declara el wrapper legacy como dependencia", () => {
    const proyecto = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));
    const instalado = JSON.parse(
      fs.readFileSync(path.join(raiz, "node_modules/react-router/package.json"), "utf8"),
    );
    expect(instalado.version.split(".")[0]).toBe("7");
    expect(proyecto.dependencies["react-router"]).toBe(instalado.version);
    expect(proyecto.dependencies["react-router-dom"]).toBeUndefined();
    expect(proyecto.devDependencies["react-router-dom"]).toBeUndefined();
  });

  it("el alias declara una sola instancia por especificador y ningún wrapper legacy", () => {
    const especificadores = alias
      .filter((a) => a.find instanceof RegExp)
      .map((a) => (a.find as RegExp).source);
    expect(new Set(especificadores).size).toBe(especificadores.length);
    expect(especificadores).not.toContain("^react-router-dom$");
  });

  it("la app, sus mocks y los fixtures sólo importan especificadores canónicos", () => {
    const importLegacy = /\b(?:from|import\s*(?:\(|(?=["']))|require\s*\(|vi\.(?:mock|doMock|unmock|doUnmock|importActual|importMock)\s*\()\s*["']react-router-dom(?:\/[^"']*)?["']/;
    const violaciones: string[] = [];
    for (const carpeta of ["src", "tests", "e2e"]) {
      const directorio = path.join(raiz, carpeta);
      if (!fs.existsSync(directorio)) continue;
      for (const archivo of walk(directorio, { exts: ["ts", "tsx", "js", "jsx", "mjs", "cjs"] })) {
        if (importLegacy.test(fs.readFileSync(archivo, "utf8"))) {
          violaciones.push(relPath(raiz, archivo));
        }
      }
    }
    expect(violaciones, "Usa react-router; las APIs DOM específicas van en react-router/dom").toEqual([]);
  });
});
