/**
 * Contrato del paquete Router 8: exports ESM públicos, runtime compatible e
 * imports canónicos. Los contratos de navegación/nuqs/Sentry cubren contexto
 * compartido en runtime sin aliases a rutas internas de node_modules.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { aliasVitest } from "../../../vitest.shared";
import { walk, relPath } from "../../../scripts/lib/walk";

const raiz = process.cwd();
const proyecto = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));
const paqueteDir = path.join(raiz, "node_modules/react-router");
const instalado = JSON.parse(fs.readFileSync(path.join(paqueteDir, "package.json"), "utf8"));

describe("React Router · contrato con el paquete", () => {
  it("los exports públicos core/DOM apuntan a módulos ESM existentes", () => {
    expect(instalado.type).toBe("module");
    for (const especificador of [".", "./dom"]) {
      for (const condicion of ["development", "default"]) {
        const archivo: string = instalado.exports[especificador][condicion];
        expect(archivo).toMatch(/\.(?:mjs|js)$/);
        expect(fs.existsSync(path.join(paqueteDir, archivo)), `${especificador}/${condicion}: ${archivo}`).toBe(true);
      }
    }
  });

  it("usa Router 8 sin la dependencia del wrapper legacy", () => {
    expect(instalado.version.split(".")[0]).toBe("8");
    expect(proyecto.dependencies["react-router"]).toBe(instalado.version);
    expect(proyecto.dependencies["react-router-dom"]).toBeUndefined();
    expect(proyecto.devDependencies["react-router-dom"]).toBeUndefined();
  });

  it("declara y ejecuta un Node compatible con el mínimo de Router 8", () => {
    expect(proyecto.engines.node).toBe(instalado.engines.node);
    const [major, minor] = process.versions.node.split(".").map(Number);
    expect(major > 22 || (major === 22 && minor >= 22), `Node ${process.versions.node}; se requiere >=22.22.0`).toBe(true);
  });

  it("Vitest usa exports públicos sin overrides de Router", () => {
    const aliases = aliasVitest(raiz);
    for (const especificador of ["react-router", "react-router/dom", "react-router-dom"]) {
      expect(aliases.some(({ find }) => typeof find === "string" ? find === especificador : find.test(especificador))).toBe(false);
    }
  });

  it("la app, sus mocks y los fixtures no importan el wrapper ni adaptadores obsoletos", () => {
    const importObsoleto = /\b(?:from|import\s*(?:\(|(?=["']))|require\s*\(|vi\.(?:mock|doMock|unmock|doUnmock|importActual|importMock)\s*\()\s*["'](?:react-router-dom(?:\/[^"']*)?|nuqs\/adapters\/react-router(?:\/v[67])?)["']/;
    const violaciones: string[] = [];
    for (const carpeta of ["src", "tests", "e2e"]) {
      const directorio = path.join(raiz, carpeta);
      if (!fs.existsSync(directorio)) continue;
      for (const archivo of walk(directorio, { exts: ["ts", "tsx", "js", "jsx", "mjs", "cjs"] })) {
        if (importObsoleto.test(fs.readFileSync(archivo, "utf8"))) violaciones.push(relPath(raiz, archivo));
      }
    }
    expect(violaciones, "Usa react-router, react-router/dom y nuqs/adapters/react-router/v8").toEqual([]);
  });
});
