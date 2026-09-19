/**
 * Contract test de los alias de React Router usados SÓLO en Vitest
 * (P2 auditoría stack).
 *
 * Analogía: es el acta de un acuerdo con el paquete. Los alias apuntan a
 * archivos concretos dentro de `node_modules/react-router*`; si una versión
 * nueva los renombra o mueve, este test falla con un mensaje claro en vez de
 * dejar el error difuso "useNavigate() may be used only in the context of a
 * <Router>" en cientos de pruebas.
 *
 * Por qué el alias sigue siendo necesario: `react-router-dom` se resuelve como
 * CJS y `react-router` (que importa `nuqs/adapters/react-router/v7`) como ESM,
 * lo que crea DOS instancias del contexto del router en pruebas. Fijar la
 * variante ESM de ambos garantiza una sola instancia. No aplica al build de
 * producción. La alternativa (migrar a Data Router) está fuera de alcance.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { aliasVitest } from "../../../vitest.shared";

const raiz = process.cwd();
const alias = aliasVitest(raiz);

function destino(patron: RegExp): string {
  const entrada = alias.find(
    (a) => a.find instanceof RegExp && a.find.source === patron.source,
  );
  if (!entrada) throw new Error(`Alias ausente para ${patron.source}`);
  return entrada.replacement;
}

describe("alias de React Router en Vitest · contrato con el paquete", () => {
  it("los tres archivos ESM aliaseados existen en node_modules", () => {
    for (const patron of [/^react-router-dom$/, /^react-router$/, /^react-router\/dom$/]) {
      const archivo = destino(patron);
      expect(fs.existsSync(archivo), `No existe ${archivo} (¿cambió el layout del paquete?)`).toBe(true);
    }
  });

  it("los destinos son módulos ESM (.mjs), no CJS", () => {
    for (const patron of [/^react-router-dom$/, /^react-router$/, /^react-router\/dom$/]) {
      expect(destino(patron).endsWith(".mjs")).toBe(true);
    }
  });

  it("react-router y react-router-dom están en la misma major 7", () => {
    const leerVersion = (paquete: string): string =>
      JSON.parse(
        fs.readFileSync(path.join(raiz, "node_modules", paquete, "package.json"), "utf8"),
      ).version as string;
    const router = leerVersion("react-router");
    const dom = leerVersion("react-router-dom");
    expect(router.split(".")[0]).toBe("7");
    expect(dom.split(".")[0]).toBe("7");
    // Una divergencia de minor entre ambos también duplica el contexto.
    expect(dom.split(".").slice(0, 2).join(".")).toBe(router.split(".").slice(0, 2).join("."));
  });

  it("el alias declara una sola instancia por especificador", () => {
    const especificadores = alias
      .filter((a) => a.find instanceof RegExp)
      .map((a) => (a.find as RegExp).source);
    expect(new Set(especificadores).size).toBe(especificadores.length);
  });
});
