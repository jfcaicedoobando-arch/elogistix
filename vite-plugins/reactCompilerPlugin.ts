import type { Plugin } from "vite";

/**
 * React Compiler (Fase 3) — post-transform Babel plugin en modo `annotation`.
 *
 * Estrategia de rollout de riesgo cero:
 * - `compilationMode: "annotation"` → SOLO compila archivos con la directiva
 *   `"use memo"` en la primera línea. El resto pasa sin tocarse.
 * - Filtro barato pre-Babel: si el source no contiene `"use memo"` NUNCA se
 *   invoca Babel (evita parsear miles de archivos innecesariamente).
 * - Corre DESPUÉS de `@vitejs/plugin-react-swc`, sobre el JS ya transformado.
 *
 * Para opt-in en un archivo, ponerlo como primera línea del módulo:
 *   "use memo";
 *
 * Ver https://react.dev/learn/react-compiler para la lista de "rules of react"
 * que el compilador exige (no mutar props/state, hooks al top-level, etc.).
 */
export function reactCompilerPlugin(): Plugin {
  let babel: typeof import("@babel/core") | null = null;
  let compilerPlugin: unknown = null;

  return {
    name: "react-compiler-annotation",
    enforce: "post",
    async configResolved() {
      // Lazy-load: no queremos cargar Babel si no hay archivos anotados.
      babel = await import("@babel/core");
      const mod = await import("babel-plugin-react-compiler");
      // ESM/CJS interop
      compilerPlugin = (mod as { default?: unknown }).default ?? mod;
    },
    async transform(code, id) {
      // Filtro barato: sólo procesar archivos que hayan hecho opt-in.
      if (!code.includes('"use memo"') && !code.includes("'use memo'")) {
        return null;
      }
      if (!/\.(tsx|jsx)$/.test(id)) return null;
      if (id.includes("node_modules")) return null;
      if (!babel || !compilerPlugin) return null;

      const result = await babel.transformAsync(code, {
        filename: id,
        babelrc: false,
        configFile: false,
        sourceMaps: true,
        plugins: [
          [compilerPlugin, { compilationMode: "annotation" }],
        ],
        parserOpts: {
          plugins: ["jsx", "typescript"],
        },
      });

      if (!result?.code) return null;
      return { code: result.code, map: result.map ?? null };
    },
  };
}
