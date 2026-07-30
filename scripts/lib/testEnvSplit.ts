/**
 * Clasificación de archivos de test por entorno (v13.344.0).
 *
 * Se usa desde `vitest.config.ts` para repartir la suite en dos proyectos:
 *   - jsdom → cualquier `.test.tsx` (renderiza React) o `.test.ts` que
 *     referencie APIs del navegador.
 *   - node  → el resto (dominio puro, utils, guardrails de arquitectura).
 *
 * La detección es conservadora: ante la duda el archivo va a jsdom, que es el
 * entorno que siempre funcionó. Un falso positivo sólo cuesta tiempo; un falso
 * negativo rompería el test, así que la lista de marcadores es amplia.
 */
import fs from "node:fs";
import path from "node:path";

/** Marcadores que implican necesitar `window`/`document`. */
const DOM_MARKERS = [
  "@testing-library",
  "jsdom",
  "document.",
  "window.",
  "localStorage",
  "sessionStorage",
  "matchMedia",
  "HTMLElement",
  "navigator.",
  "requestAnimationFrame",
  "IntersectionObserver",
  "ResizeObserver",
  "URL.createObjectURL",
  "browserStorage",
];

/**
 * Overrides: tests `.ts` que SÍ necesitan DOM real (window.open, Blob+anchor,
 * navigator) aunque no lo declaren con los marcadores de arriba, porque el uso
 * está en el módulo bajo prueba, no en el test.
 */
const FORCE_JSDOM = new Set<string>([
  "src/lib/io/__tests__/zipDownload.test.ts",
  "src/generators/__tests__/estadoCuentaPdf.test.ts",
  "src/services/observability/__tests__/trackNavEvent.test.ts",
]);

function walkTests(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkTests(full, out);
    else if (/\.(test|spec)\.tsx?$/.test(entry.name)) out.push(full);
  }
}

export interface TestEnvSplit {
  /** Globs (relativos a la raíz) que deben correr en jsdom. */
  jsdom: string[];
  /** Globs (relativos a la raíz) que pueden correr en node. */
  node: string[];
}

/**
 * Recorre `src/` una sola vez al cargar la config y devuelve las dos listas.
 * Coste medido: ~80 ms para ~850 archivos.
 */
export function splitTestsByEnvironment(root: string): TestEnvSplit {
  const srcDir = path.join(root, "src");
  const files: string[] = [];
  walkTests(srcDir, files);

  const jsdom: string[] = [];
  const node: string[] = [];
  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join("/");
    if (file.endsWith(".tsx") || FORCE_JSDOM.has(rel)) { jsdom.push(rel); continue; }
    const body = fs.readFileSync(file, "utf8");
    (DOM_MARKERS.some((m) => body.includes(m)) ? jsdom : node).push(rel);
  }
  return { jsdom, node };
}
