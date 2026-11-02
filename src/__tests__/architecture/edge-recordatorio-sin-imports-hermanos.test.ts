/**
 * El empaquetador de Edge sólo sube la carpeta de la función y `_shared/`.
 * Un import hacia otra función hermana pasa en pruebas locales (todo el repo
 * está presente) pero falla al desplegar con «Module not found».
 *
 * Recorre el grafo de imports relativos de los tres puntos de entrada de
 * recordatorios y exige que cada archivo alcanzado viva en la carpeta de la
 * propia función o bajo `_shared/`.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const FUNCTIONS = path.resolve(__dirname, "../../../supabase/functions");

const ENTRADAS = [
  "cxc-recordatorio-enviar",
  "cxc-recordatorio-destinatario",
  "cxc-recordatorio-confirmar",
] as const;

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\1/g;
const MAX_ARCHIVOS = 500;

interface Grafo {
  archivos: string[];
  fuera: string[];
  faltantes: string[];
}

/** Grafo de imports relativos alcanzables desde `<raiz>/<funcion>/index.ts`. */
function recorrerGrafo(raiz: string, funcion: string): Grafo {
  const entrada = path.join(raiz, funcion, "index.ts");
  const visitados = new Set<string>();
  const pendientes = [entrada];
  const fuera: string[] = [];
  const faltantes: string[] = [];
  while (pendientes.length > 0 && visitados.size < MAX_ARCHIVOS) {
    const archivo = pendientes.pop() as string;
    if (visitados.has(archivo)) continue;
    visitados.add(archivo);
    const relativo = path.relative(raiz, archivo).split(path.sep);
    if (relativo[0] !== funcion && relativo[0] !== "_shared") {
      fuera.push(relativo.join("/"));
    }
    if (!fs.existsSync(archivo)) {
      faltantes.push(relativo.join("/"));
      continue;
    }
    const fuente = fs.readFileSync(archivo, "utf8");
    for (const match of fuente.matchAll(IMPORT_RE)) {
      pendientes.push(path.resolve(path.dirname(archivo), match[2]));
    }
  }
  const archivos = [...visitados].map((a) => path.relative(raiz, a).split(path.sep).join("/"));
  return { archivos, fuera, faltantes };
}

describe("Edge recordatorios: grafo empaquetable por carpeta", () => {
  it.each(ENTRADAS)("%s sólo importa su carpeta y _shared", (funcion) => {
    const grafo = recorrerGrafo(FUNCTIONS, funcion);
    expect(grafo.faltantes).toEqual([]);
    expect(grafo.fuera).toEqual([]);
  });

  it("el recorrido alcanza el código compartido de recordatorios", () => {
    const enviar = recorrerGrafo(FUNCTIONS, "cxc-recordatorio-enviar").archivos;
    const confirmar = recorrerGrafo(FUNCTIONS, "cxc-recordatorio-confirmar").archivos;
    const destinatario = recorrerGrafo(FUNCTIONS, "cxc-recordatorio-destinatario").archivos;
    expect(enviar).toContain("_shared/recordatorio/handler.ts");
    expect(enviar).toContain("_shared/recordatorio/entrega.ts");
    expect(confirmar).toContain("_shared/recordatorio/handler.ts");
    expect(destinatario).toContain("_shared/recordatorio/bodySchema.ts");
    expect(destinatario).toContain("cxc-recordatorio-destinatario/handler.ts");
  });

  it("detecta un import hacia una función hermana", () => {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "edge-grafo-"));
    try {
      fs.mkdirSync(path.join(raiz, "fn-a"));
      fs.mkdirSync(path.join(raiz, "fn-b"));
      fs.mkdirSync(path.join(raiz, "_shared"));
      fs.writeFileSync(path.join(raiz, "fn-a", "index.ts"),
        "import { x } from '../_shared/x.ts';\nimport { y } from '../fn-b/y.ts';\n");
      fs.writeFileSync(path.join(raiz, "_shared", "x.ts"), "export const x = 1;\n");
      fs.writeFileSync(path.join(raiz, "fn-b", "y.ts"), "export const y = 2;\n");
      expect(recorrerGrafo(raiz, "fn-a").fuera).toEqual(["fn-b/y.ts"]);
    } finally {
      fs.rmSync(raiz, { recursive: true, force: true });
    }
  });
});
