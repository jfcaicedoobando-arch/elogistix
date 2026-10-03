import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const FUNCTIONS = path.resolve(process.cwd(), "supabase/functions");
const FUNCTION_NAME = "facturapi-recuperar-claim";
const FUNCTION_DIR = path.join(FUNCTIONS, FUNCTION_NAME);
const FILES = readdirSync(FUNCTION_DIR).filter((file) => file.endsWith(".ts"));

// El despliegue incluye la carpeta de la función y _shared, no funciones hermanas.
describe("recuperación Facturapi: imports compatibles con el paquete desplegado", () => {
  it.each(FILES)("%s sólo importa archivos propios o compartidos", (file) => {
    const source = readFileSync(path.join(FUNCTION_DIR, file), "utf8");
    const imports = source.matchAll(/(?:from\s+|import\s*)["'](\.{1,2}\/[^"']+)["']/g);
    for (const [, specifier] of imports) {
      const target = path.resolve(FUNCTION_DIR, specifier);
      const [owner] = path.relative(FUNCTIONS, target).split(path.sep);
      expect([FUNCTION_NAME, "_shared"], `${file}: ${specifier} queda fuera del paquete`).toContain(owner);
    }
  });
});
