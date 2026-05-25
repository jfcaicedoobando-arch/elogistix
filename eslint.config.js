import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Power of 10 §5/§10 — Tipado estricto: prohibido `any` sin override documentado.
      // Para casos legítimos puntuales usar `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.
      "@typescript-eslint/no-explicit-any": "error",
      // Architectural guardrails — prevent drift back into oversized files
      // Hard cap at 300 LOC; soft warning at 250 to encourage early splitting.
      "max-lines": ["warn", { max: 250, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 200, skipBlankLines: true, skipComments: true, IIFEs: true }],
      "complexity": ["warn", { max: 12 }],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 5],
      // Architectural guardrail — barrel imports for hooks/services
      // Enforces ARCHITECTURE.md §4-§5: importar siempre desde el barrel
      // del dominio (`@/hooks/<dominio>` o `@/services/<dominio>`), no desde
      // archivos internos. Las importaciones internas dentro del propio
      // dominio están exentas (ver bloque siguiente).
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/hooks/*/*"],
            message: "Importa desde el barrel del dominio: '@/hooks/<dominio>' en lugar de archivos internos. Ver ARCHITECTURE.md §4.",
          },
          {
            group: ["@/services/*/*"],
            message: "Importa desde el barrel del dominio: '@/services/<dominio>' en lugar de archivos internos. Ver ARCHITECTURE.md §5.",
          },
        ],
        paths: [
          {
            name: "@/components/ui/table",
            message: "Usa <DataTable /> de '@/components/shared/DataTable' para estandarizar tablas. Solo casos editables/excepcionales pueden importar las primitivas; documenta y agrega allowlist en eslint.config.js.",
          },
        ],
      }],
    },
  },
  {
    // Exemptions: generated types, UI primitives (shadcn), data catalogs, and tests
    files: [
      "src/components/ui/**",
      "src/integrations/supabase/**",
      "src/data/changelogData.ts",
      "src/data/ports.ts",
      "src/content/changelog/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "complexity": "off",
      // Shadcn primitives y catálogos exportan variantes/constantes
      // junto al componente — patrón estándar, no impacta a HMR de pantallas.
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Tests-only: console.log para perf benchmarks, regex de control para
    // validar sanitización de paths, y `as any` para fixtures parciales son
    // patrones legítimos en specs.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-console": "off",
      "no-control-regex": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Primitiva de UI: re-exporta `defineColumns` + tipos junto al componente
    // (mismo patrón que `src/components/ui/**`). El warning de Fast Refresh es
    // ruido para esta convención del proyecto.
    files: ["src/components/shared/DataTable.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Registro central de query keys: catálogo plano (un literal por línea)
    // por dominio. Dividirlo en archivos rompería el patrón "una sola fuente
    // de verdad" que enforz el guardrail no-restricted-syntax.
    files: ["src/lib/query/index.ts"],
    rules: {
      "max-lines": "off",
    },
  },
  {
    // Contexts y barrels: re-exportan helpers/hooks junto al Provider.
    // El componente raíz de cada contexto rara vez se edita; el warning
    // de Fast Refresh es ruido para esta convención del proyecto.
    files: ["src/contexts/**"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Hooks y services pueden hacer imports internos a su propio árbol
    // (composición intra-dominio, sub-barrels, helpers privados).
    files: ["src/hooks/**", "src/services/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // `src/lib/**` es la capa más baja: NO puede depender de hooks ni de
    // componentes (eso invierte la jerarquía Pages→Hooks→Services→Lib).
    // Tipos compartidos viven en `src/types/`.
    files: ["src/lib/**"],
    ignores: ["src/lib/**/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/hooks/*", "@/hooks/**"],
            message: "lib/ no puede importar de hooks/. Mueve el tipo a src/types/ o invierte la dependencia.",
          },
          {
            group: ["@/components/*", "@/components/**"],
            message: "lib/ no puede importar de components/. lib/ es puro (sin React).",
          },
          {
            group: ["@/pages/*", "@/pages/**"],
            message: "lib/ no puede importar de pages/.",
          },
        ],
      }],
    },
  },
  {
    // `src/services/**` es la capa de acceso a datos: solo puede tocar
    // Supabase + utils de `lib/`. NO puede importar hooks, componentes,
    // páginas ni contexts (eso invierte la jerarquía).
    files: ["src/services/**"],
    ignores: ["src/services/**/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/hooks/*", "@/hooks/**"],
            message: "services/ no puede importar de hooks/. Invierte la dependencia: el hook llama al service.",
          },
          {
            group: ["@/components/*", "@/components/**"],
            message: "services/ no puede importar de components/. services/ es puro (sin React).",
          },
          {
            group: ["@/pages/*", "@/pages/**"],
            message: "services/ no puede importar de pages/.",
          },
          {
            group: ["@/contexts/*", "@/contexts/**"],
            message: "services/ no puede importar de contexts/. Pasa el dato como parámetro.",
          },
        ],
      }],
    },
  },
  {
    // Allowlist de tablas: el propio DataTable y tablas editables/excepcionales
    // que aún no migran a DataTable. Documentar caso a caso.
    files: [
      "src/components/shared/DataTable.tsx",
      "src/components/shared/dataTable/**",
      // Casos editables / con render row complejo — quedan fuera de la migración:
      "src/components/cotizacion/SeccionMercanciaAerea.tsx",
      "src/components/cotizacion/SeccionMercanciaMaritimeLCL.tsx",
      "src/components/cotizacion/SeccionMercanciaCotizacionDetalle.tsx",
      "src/components/cotizacion/TablaConceptosGenerico.tsx",
      "src/components/cotizacion/TablaCostosDetalle.tsx",
      "src/components/embarque/DialogDuplicarEmbarque.tsx",
      // Sub-tablas read-only estáticas (sin sort/paginación) — no requieren DataTable:
      "src/components/cotizacion/seccionMercancia/DimensionesLCLTable.tsx",
      "src/components/cotizacion/seccionMercancia/DimensionesAereasTable.tsx",
      // Render row custom para fila "ver detalle" debajo del DataTable principal:
      "src/components/embarque/tabResumen/EmbarquesRelacionadosCard.tsx",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
);
