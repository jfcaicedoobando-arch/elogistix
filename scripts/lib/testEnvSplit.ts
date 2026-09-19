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
 * Overrides por ruta (legado): tests `.ts` que SÍ necesitan DOM real
 * (window.open, Blob+anchor, navigator) aunque no lo declaren con los
 * marcadores de arriba, porque el uso está en el módulo bajo prueba.
 *
 * Para casos NUEVOS no se agrega a esta lista: se declara el entorno en el
 * propio archivo con el docblock estándar de Vitest (ver `ENV_DECLARADO`).
 */
const FORCE_JSDOM = new Set<string>([
  "src/lib/io/__tests__/zipDownload.test.ts",
  "src/generators/__tests__/estadoCuentaPdf.test.ts",
  "src/services/observability/__tests__/trackNavEvent.test.ts",
]);

/**
 * Declaración explícita del entorno dentro del archivo de test (P2 auditoría
 * stack). Formato estándar de Vitest, en cualquier comentario del archivo:
 *
 *   // @vitest-environment jsdom
 *
 * Gana siempre sobre la heurística de marcadores y sobre la extensión, así que
 * un test `.ts` que necesita DOM (o un `.tsx` que deliberadamente no lo usa)
 * queda documentado en su propio archivo en vez de en una lista remota.
 */
const ENV_DECLARADO = /@vitest-environment\s+(jsdom|node)\b/;

/** Entorno declarado en el archivo, o `null` si no declara ninguno. */
export function entornoDeclarado(contenido: string): "jsdom" | "node" | null {
  const m = ENV_DECLARADO.exec(contenido);
  return m ? (m[1] as "jsdom" | "node") : null;
}

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
    const body = fs.readFileSync(file, "utf8");
    // 1) Declaración explícita en el archivo: manda sobre todo lo demás.
    const declarado = entornoDeclarado(body);
    if (declarado) { (declarado === "jsdom" ? jsdom : node).push(rel); continue; }
    // 2) Extensión .tsx u override legado por ruta.
    if (file.endsWith(".tsx") || FORCE_JSDOM.has(rel)) { jsdom.push(rel); continue; }
    // 3) Heurística de marcadores de DOM (conservadora: duda → jsdom).
    (DOM_MARKERS.some((m) => body.includes(m)) ? jsdom : node).push(rel);
  }
  return { jsdom, node };
}
