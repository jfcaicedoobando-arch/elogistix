import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactCompiler from "eslint-plugin-react-compiler";
import tseslint from "typescript-eslint";

// Selectores base de `no-restricted-syntax` compartidos por toda la config
// (existentes desde React 19). El bloque de query keys inline se agrega
// aparte para poder eximir la allowlist LEGACY sin perder estas 3 reglas.
const NO_RESTRICTED_SYNTAX_BASE = [
  {
    selector: "ImportDeclaration[source.value='lucide-react'] > ImportNamespaceSpecifier",
    message: "No uses `import * as ... from 'lucide-react'`. Usa named imports para preservar tree-shaking.",
  },
  {
    selector: "CallExpression[callee.name='useEffect'] MemberExpression[object.name='supabase']",
    message: "React 19 · No llames a `supabase` dentro de `useEffect`. Usa `useQuery`/`useMutation` de @tanstack/react-query (ver mem://principles/power-of-10 §5).",
  },
  {
    selector: "CallExpression[callee.name='useEffect'] CallExpression[callee.name='fetch']",
    message: "React 19 · No uses `fetch()` imperativo dentro de `useEffect`. Envuélvelo en `useQuery` para obtener cache, retry y cleanup automáticos.",
  },
];

// PR-5 · Ítem 3.4 (arq-4). Consolidación de formatters: prohibido usar
// `toLocaleString` / `toLocaleDateString` / `new Intl.NumberFormat(...)` inline
// en código de producción. Migra a `@/lib/formatters` (`formatCurrency`,
// `formatNumber`, `formatDate`, `formatFechaEs`, `formatFechaHora`,
// `formatFechaLarga`). Excepciones: los propios formatters y una allowlist
// LEGACY (bloque `locale-format-legacy` al final) que se migrará en olas.
const NO_LOCALE_FMT_SELECTORS = [
  {
    selector: "CallExpression[callee.property.name='toLocaleString']",
    message: "PR-5 · Ítem 3.4: usa `formatCurrency`/`formatNumber`/`formatFechaHora` de `@/lib/formatters` en vez de `.toLocaleString(...)` inline.",
  },
  {
    selector: "CallExpression[callee.property.name='toLocaleDateString']",
    message: "PR-5 · Ítem 3.4: usa `formatDate`/`formatFechaEs`/`formatFechaLarga` de `@/lib/formatters` en vez de `.toLocaleDateString(...)` inline.",
  },
  {
    selector: "NewExpression[callee.object.name='Intl'][callee.property.name='NumberFormat']",
    message: "PR-5 · Ítem 3.4: usa `formatNumber`/`formatCurrency` de `@/lib/formatters` en vez de `new Intl.NumberFormat(...)` inline.",
  },
];

// Reglas queryKey/mutationKey/TASA_IVA — se declaran una sola vez para poder
// reusar en la allowlist locale-format-legacy sin duplicarlas.
const QUERY_KEY_AND_IVA_RULES = [
  {
    selector: "Property[key.name='queryKey'] > ArrayExpression",
    message: "No definas `queryKey` inline. Usa el builder de `src/features/<dominio>/queryKeys.ts` (o `src/lib/query`) para mantener una sola fuente de verdad y evitar cachés fragmentados.",
  },
  {
    selector: "Property[key.name='mutationKey'] > ArrayExpression",
    message: "No definas `mutationKey` inline. Declara la key en `queryKeys.ts` del dominio para poder referenciarla desde `useIsMutating`/DevTools.",
  },
  {
    // Bloque 2.4 arquitectura — fuente única DB↔TS para el IVA. La tasa
    // 16% vive exclusivamente en `TASA_IVA` (src/lib/financial/financialUtils.ts).
    selector: "Literal[value=0.16]",
    message: "No hardcodees `0.16`. Importa `TASA_IVA` desde `@/lib/financial/financialUtils` o resuelve la tasa dinámica del concepto (`resolverTasaConcepto`). Ver mem://core (Never hardcode VAT).",
  },
];


// Lista de features top-level bajo `src/features/`. Se usa para generar
// programáticamente los overrides de cross-feature deep imports (Bloque 2.3
// arquitectura). Mantener sincronizada con `ls src/features/`.
const FEATURES = [
  "admin","auditoria","auth","bandejas","catalogos","cliente","comisiones",
  "compras","configuracion","costeo","cotizacion","crm","cxp","dashboard",
  "dashboardEjecutivo","dev","embarques","facturacion","legal","marketing",
  "notificaciones","onboarding","operaciones","portal","portal-agente",
  "presupuesto","profit","proformas","proveedor","reportes","search","tesoreria",
];

// ARCH-DEBT · Bloque 2.3: allowlist temporal de imports cross-feature ya
// existentes al momento de introducir la regla (baseline v13.309.4). Cada
// archivo debería salir de la lista promoviendo el módulo compartido a
// `src/components/shared/` o `src/lib/{ui,domain}/`, o duplicando la lógica
// dentro del feature consumidor. NO agregar entradas nuevas sin PR justificado.
const CROSS_FEATURE_ALLOWLIST = [
  "src/features/admin/components/TabCatalogosGlobales.tsx",
  "src/features/admin/hooks/useAdminOrgConfig.ts",
  "src/features/admin/routes/admin-org/Configuracion.tsx",
  "src/features/auth/routes/TrackingPublico.tsx",
  "src/features/bandejas/routes/CxpPorCapturar.tsx",
  "src/features/cliente/routes/ClienteDetalle.tsx",
  "src/features/cliente/services/financials.ts",
  "src/features/compras/routes/ComprasPorAprobar.tsx",
  "src/features/configuracion/components/TabOperaciones.tsx",
  "src/features/cotizacion/components/TarifaVinculadaPanel.tsx",
  "src/features/cotizacion/components/revalidacion/CrearEmbarqueConRevalidacion.tsx",
  "src/features/cotizacion/components/seccionRuta/OrigenDestinoBlock.tsx",
  "src/features/cotizacion/components/seccionRuta/SugerenciasTarifaInline.tsx",
  "src/features/dashboardEjecutivo/components/BandaKPIs.tsx",
  "src/features/dashboardEjecutivo/services/types.ts",
  "src/features/embarques/components/TabSeguros.tsx",
  "src/features/embarques/components/conceptos/ConceptoCatalogoSelect.tsx",
  "src/features/embarques/components/reconciliacion/ReconciliacionTresColumnas.tsx",
  "src/features/embarques/components/reconciliacion/ResumenReconciliacion.tsx",
  "src/features/embarques/components/reconciliacion/reconciliacionFormat.ts",
  "src/features/embarques/components/stepDatosRuta/StepDatosRutaMaritimo.tsx",
  "src/features/embarques/domain/embarqueWizard.ts",
  "src/features/embarques/domain/mappers/embarqueToDb.ts",
  "src/features/embarques/hooks/useHidratacionEditarEmbarque.ts",
  "src/features/embarques/hooks/useReconciliacion3Columnas.ts",
  "src/features/embarques/hooks/useUmbralesReconciliacion.ts",
  "src/features/embarques/services/reconciliacion3Columnas.ts",
  "src/features/embarques/services/submitProformaDialog.ts",
  "src/features/portal-agente/components/AgenteLayout.tsx",
  "src/features/portal-agente/components/AgenteTarifaForm.tsx",
  "src/features/portal-agente/routes/AgenteGarantias.tsx",
  "src/features/portal/components/EmbarqueCard.tsx",
  "src/features/portal/components/dashboard/PortalEmbarquesRecientesCard.tsx",
  "src/features/portal/components/dashboard/PortalProximosArribosCard.tsx",
  "src/features/portal/hooks/usePortalDashboardKpis.ts",
  "src/features/portal/hooks/usePortalEmbarquesController.ts",
  "src/features/portal/routes/PortalCotizacionDetalle.tsx",
  "src/features/portal/routes/PortalEmbarques.tsx",
  "src/features/portal/services/queries.ts",
  "src/features/presupuesto/components/TabVsReal.tsx",
  "src/features/profit/hooks/useEstadoResultados.ts",
  "src/features/profit/hooks/usePeriodoMesUrl.ts",
  "src/features/profit/routes/ProfitDashboardEjecutivo.tsx",
  "src/features/profit/routes/ProfitPresupuesto.tsx",
  "src/features/profit/routes/ProfitProyeccion.tsx",
  "src/features/profit/services/estadoResultados.ts",
  "src/features/profit/services/estadoResultadosDevengado.ts",
  "src/features/proformas/components/ProformaDetalleCards.tsx",
  "src/features/proformas/routes/ProformasListado.tsx",
  "src/features/reportes/routes/CierreMensual.tsx",
  "src/features/tesoreria/routes/TesoreriaCuentas.tsx",
];

// Overrides por feature: prohíben importar hacia carpetas internas
// (components / domain / lib) de OTRAS features. Los imports vía
// `hooks`, `services`, `types`, `queryKeys` y la ruta pública (`routes`)
// se mantienen permitidos porque son la superficie estable del feature.
const crossFeatureOverrides = FEATURES.map((self) => ({
  name: `cross-feature/${self}`,
  files: [`src/features/${self}/**/*.{ts,tsx}`],
  ignores: [
    `src/features/${self}/**/__tests__/**`,
    `src/features/${self}/**/*.test.ts`,
    `src/features/${self}/**/*.test.tsx`,
    ...CROSS_FEATURE_ALLOWLIST,
  ],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: FEATURES.filter((f) => f !== self).flatMap((f) => [
        {
          group: [`@/features/${f}/components/*`, `@/features/${f}/components/**`],
          message: `Cross-feature: no importes componentes internos de '${f}'. Si es genuinamente compartido, promuévelo a 'src/components/shared/'. Ver Bloque 2.3 (arquitectura).`,
        },
        {
          group: [`@/features/${f}/domain/*`, `@/features/${f}/domain/**`],
          message: `Cross-feature: no importes de '${f}/domain'. Promueve la lógica pura a 'src/lib/domain/' o duplícala en tu feature. Ver Bloque 2.3.`,
        },
        {
          group: [`@/features/${f}/lib/*`, `@/features/${f}/lib/**`],
          message: `Cross-feature: no importes de '${f}/lib'. Promueve a 'src/lib/' (ui/domain/formatters). Ver Bloque 2.3.`,
        },
      ]),
    }],
  },
}));

export default tseslint.config(
  // v13.303.5 — Ignores ampliados: además de `dist`/`coverage` (build output),
  // excluimos artefactos que nunca deberían pasar por el parser TS de ESLint:
  //   · `.vitest-reports/`, `reports/`, `playwright-report/`, `test-results/` — outputs de test.
  //   · `node_modules/`, `.cache/` — deps y caches.
  //   · `public/`, `supabase/migrations/` — assets estáticos y SQL puro.
  //   · `**/*.md` — markdown (no procesable por el parser TS).
  { ignores: [
    "dist",
    "coverage",
    ".vitest-reports",
    "reports",
    "playwright-report",
    "test-results",
    "node_modules",
    "**/.cache/**",
    "public",
    "supabase/migrations",
    "**/*.md",
  ] },
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
      "react-compiler": reactCompiler,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // 13.274.0 — Estándares React 19 (con Compiler habilitado):
      // React 19.2 + `"use memo"` opt-in. `react-compiler` en modo warn para
      // no explotar CI con las 3 violaciones históricas conocidas (ver
      // `useSafeNavigate`, `sidebar`, `PlantillaSelector`), pero visibles en
      // cada `bun run lint` para presión progresiva.
      "react-compiler/react-compiler": "warn",
      // Power of 10 §5 — dependencias completas en hooks evitan stale closures.
      "react-hooks/exhaustive-deps": "error",
      // Reglas React 19 (`eslint-plugin-react-hooks` v7 "Rules of React"):
      // desactivadas de golpe (84 hits históricos) para no bloquear CI hoy.
      // Se activarán por dominio conforme se refactorice. Al tocar un archivo
      // legacy, considera activar la regla localmente con /* eslint-enable */
      // y arreglar los hits del archivo.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/static-components": "off",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/preserve-manual-memoization": "off",


      // ESLint 10 — `no-useless-assignment` nuevo en recomendado. Genera ruido
      // en patrones legítimos (asignaciones de fallback antes de un branch).
      "no-useless-assignment": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      "@typescript-eslint/no-unused-vars": "off",
      // Power of 10 §5/§10 — Tipado estricto: prohibido `any` sin override documentado.
      // Para casos legítimos puntuales usar `// eslint-disable-next-line @typescript-eslint/no-explicit-any`.
      "@typescript-eslint/no-explicit-any": "error",
      // Architectural guardrails — prevent drift back into oversized files
      // Hard cap at 300 LOC; soft warning at 250 to encourage early splitting.
      "max-lines": ["warn", { max: 250, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["warn", { max: 200, skipBlankLines: true, skipComments: true, IIFEs: true }],
      // Umbral pragmático: 16. Funciones con CC ≤ 15 son aceptables
      // (estándar de la industria es 15; subir a 16 evita refactors forzados
      // de bajo valor). Sólo warning a partir de CC ≥ 16.
      "complexity": ["warn", { max: 16 }],
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
          {
            group: ["lucide-react/dist", "lucide-react/dist/*"],
            message: "Importa lucide-react por named import (`import { X } from 'lucide-react'`). Los subpaths /dist/* no forman parte de la API pública.",
          },
        ],
        // NOTA: la restricción sobre `@/components/ui/table` vive en su propio
        // bloque `no-raw-table` al final del archivo — inmune al override que
        // apaga `no-restricted-imports` en `src/features/**`.
      }],
      // Guardrails para React 19 (13.274.0):
      // 1) Ban `import * as Icons from "lucide-react"` (rompe tree-shaking).
      // 2) Prohibir data-fetching imperativo dentro de `useEffect` — en React 19
      //    con TanStack Query, cada fetch debe vivir en un hook `useQuery` /
      //    `useMutation`. Los `useEffect` sólo son válidos para suscripciones,
      //    sincronización de estado local o efectos secundarios no-fetch.
      //    Si necesitas un caso puntual (auth listeners, timers), agrega el
      //    disable con justificación: `// eslint-disable-next-line no-restricted-syntax -- <razón>`.
      // 3) Prohibir query keys inline fuera del catálogo central (`queryKeys.ts`).
      //    Toda `queryKey`/`mutationKey` debe usar el builder de
      //    `src/features/<dominio>/queryKeys.ts` para evitar cachés
      //    fragmentados e invalidaciones que no matchean.
      //    Excepciones: los propios `queryKeys.ts`, `src/lib/query/**`,
      //    tests y una allowlist LEGACY de hooks que se migrarán en olas.
      "no-restricted-syntax": ["error",
        ...NO_RESTRICTED_SYNTAX_BASE,
        ...NO_LOCALE_FMT_SELECTORS,
        ...QUERY_KEY_AND_IVA_RULES,
      ],


    },
  },
  {
    // Exemptions: generated types, UI primitives (shadcn), data catalogs, and tests
    // Exemptions: generated types, UI primitives (shadcn), data catalogs, tests
    // y registries de rutas (sólo exportan lazy() components + objetos config).
    files: [
      "src/components/ui/**",
      "src/integrations/supabase/**",
      "src/data/ports.ts",
      "src/routes/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "max-lines": "off",
      "max-lines-per-function": "off",
      "complexity": "off",
      "max-depth": "off",
      // Shadcn primitives y catálogos exportan variantes/constantes
      // junto al componente — patrón estándar, no impacta a HMR de pantallas.
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Tests-only: console.log para perf benchmarks, regex de control para
    // validar sanitización de paths, y `as any` para fixtures parciales son
    // patrones legítimos en specs. Incluye helpers/mocks/setup bajo
    // `src/test/**` (mismas convenciones que los .test.*).
    files: ["**/*.test.ts", "**/*.test.tsx", "src/test/**"],
    rules: {
      "no-console": "off",
      "no-control-regex": "off",
      "@typescript-eslint/no-explicit-any": "off",
      // Tests declaran fixtures de queryKey/mutationKey inline para validar
      // integración con TanStack Query. Mantenemos sólo los selectores base
      // aquí (el catálogo central sólo aplica a código de producción).
      "no-restricted-syntax": ["error", ...NO_RESTRICTED_SYNTAX_BASE],
    },
  },
  {
    // Edge Functions Deno: corren en runtime Deno con imports `npm:` y
    // tipos no resueltos por el tsconfig web. `@ts-nocheck` es la salida
    // limpia documentada. El warning de Fast Refresh tampoco aplica
    // (estos archivos no se cargan en el bundle de React).
    files: ["supabase/functions/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Bloque 2.4 arquitectura — el único archivo autorizado a hardcodear la tasa
    // de IVA es el que la define (`TASA_IVA` + `TASAS_IVA_MX`). Cualquier otro
    // callsite de src debe importar la constante. Las Edge Functions corren en
    // Deno y no pueden importar `@/lib/*` (aliases del bundler web), así que
    // están exentas del guardrail — sus helpers replican la constante en el
    // propio archivo.
    files: [
      "src/lib/financial/financialUtils.ts",
      "supabase/functions/**",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    // Definiciones de columnas para DataTable: exportan `buildColumns` +
    // celdas inline (mismo patrón que primitivas shadcn). React Refresh y
    // el límite de complexity no aplican porque el render JSX condicional
    // suma branches sin lógica de negocio.
    files: ["**/*Columns.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
      "complexity": "off",
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
    files: ["src/lib/contexts/**"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // Hooks y services pueden hacer imports internos a su propio árbol
    // (composición intra-dominio, sub-barrels, helpers privados).
    files: ["src/hooks/**", "src/services/**", "src/features/**"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // `src/features/*/domain/**`: mismas garantías que `src/lib/**`
    // (capa pura, sin React, sin dependencias hacia arriba).
    files: ["src/features/*/domain/**"],
    ignores: ["src/features/*/domain/**/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/hooks/*", "@/hooks/**", "@/features/*/hooks/**"], message: "features/<x>/domain no puede importar de hooks/." },
          { group: ["@/components/*", "@/components/**", "@/features/*/components/**"], message: "features/<x>/domain no puede importar de components/. domain/ es puro (sin React)." },
          { group: ["@/pages/*", "@/pages/**", "@/features/*/routes/**"], message: "features/<x>/domain no puede importar de pages/routes/." },
          { group: ["@/features/*/services/**"], message: "features/<x>/domain no puede importar de services/. Invierte la dependencia." },
        ],
      }],
    },
  },
  {
    // `src/features/*/services/**`: mismas garantías que `src/services/**`.
    files: ["src/features/*/services/**"],
    ignores: ["src/features/*/services/**/__tests__/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["@/hooks/*", "@/hooks/**", "@/features/*/hooks/**"], message: "features/<x>/services no puede importar de hooks/." },
          { group: ["@/components/*", "@/components/**", "@/features/*/components/**"], message: "features/<x>/services no puede importar de components/. services/ es puro (sin React)." },
          { group: ["@/pages/*", "@/pages/**", "@/features/*/routes/**"], message: "features/<x>/services no puede importar de pages/routes/." },
          { group: ["@/contexts/*", "@/contexts/**"], message: "features/<x>/services no puede importar de contexts/. Pasa el dato como parámetro." },
        ],
      }],
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
    // Allowlist LEGACY del bloque anterior — mantenida por compatibilidad,
    // pero la enforcement real de `@/components/ui/table` vive en el bloque
    // `no-raw-table` al final del archivo.
    files: [
      "src/components/shared/DataTable.tsx",
      "src/components/shared/dataTable/**",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Tests de edge functions Deno (`supabase/functions/**/*_test.ts`):
    // requieren `@ts-nocheck` porque importan desde URLs Deno
    // (`https://deno.land/...`) que el TS local del proyecto no resuelve.
    // Es intencional — silenciamos la regla en este glob.
    files: ["supabase/functions/**/*_test.ts"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  {
    // Allowlist de complejidad/anidamiento: flujos legacy con CC alto que
    // aún no se refactorizan. Documentar caso a caso y planear la división.
    // CI corre `eslint --max-warnings 0`, así que cualquier warning aquí
    // tira el job; se relajan SOLO las reglas estructurales (no de tipos).
    files: [
      "src/features/facturacion/components/FacturasMasivasToolbar.tsx",
      "src/features/facturacion/services/dashboardEjecutivo.ts",
      "supabase/functions/facturapi-cancelar/index.ts",
      "supabase/functions/facturapi-emitir/index.ts",
    ],
    rules: {
      "complexity": "off",
      "max-depth": "off",
    },
  },
  {
    // Plan E (13.63.0) — Guardrail para `@sentry/*` en capas de UI.
    // El SDK pesa ~150 KB y sólo debe importarse STÁTICAMENTE desde la capa
    // de observabilidad. Páginas/componentes/contexts/lib deben usar
    // `await import("@sentry/react")` dinámico para mantenerlo fuera del
    // bundle inicial. Hooks/services/features ya están exentos de
    // `no-restricted-imports` por sus overrides previos; los imports
    // estáticos legados en esas capas se migrarán a lazy progresivamente.
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/pages/**/*.{ts,tsx}",
      "src/contexts/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
    ],
    ignores: [
      "src/lib/observability/sentry/**",
      "src/components/shared/ErrorBoundary.tsx",
      "src/components/shared/errorBoundary/**",
      "src/components/feedback/**",
      "src/features/admin/routes/SentryDiagnostico.tsx",
      "src/lib/observability/hooks/**",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@sentry/*"],
            message:
              "Importar `@sentry/*` estáticamente sólo se permite desde `src/lib/observability/sentry/**`, `ErrorBoundary`, `components/feedback/**` y `SentryDiagnostico`. En el resto usa `await import('@sentry/react')` dinámico para mantener el SDK fuera del bundle inicial.",
          },
        ],
      }],
    },
  },
  {
    // ─────────────────────────────────────────────────────────────────────
    // Guardrail `inline-query-keys` — allowlist LEGACY (13.279.0).
    //
    // Los archivos abajo aún declaran `queryKey`/`mutationKey` inline. Se
    // migrarán en olas al catálogo central `src/features/<dominio>/queryKeys.ts`.
    // Al migrar un archivo: quítalo de esta lista. NO agregues archivos
    // nuevos aquí — el guardrail existe para bloquear regresiones.
    //
    // Este bloque redefine `no-restricted-syntax` con SÓLO los selectores
    // base (lucide-namespace + useEffect+supabase/fetch), omitiendo los
    // selectores `queryKey`/`mutationKey`. En ESLint flat-config el último
    // bloque coincidente gana para esa regla.
    // ─────────────────────────────────────────────────────────────────────
    name: "inline-query-keys-legacy",
    files: ["src/__never_match__.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...NO_RESTRICTED_SYNTAX_BASE],
    },
  },
  {
    // ─────────────────────────────────────────────────────────────────────
    // Guardrail `no-raw-table` — design system de tablas.
    //
    // Prohibido importar `@/components/ui/table` (primitivas shadcn) fuera
    // de la allowlist. Todas las listas deben usar `<DataTable />` de
    // `@/components/shared/DataTable` + los builders (`defineColumns`,
    // `columnBuilders`, `StatusBadge`) para unificar el design language.
    //
    // Este bloque va aparte porque el override de `src/features/**` apaga
    // `no-restricted-imports` completo; scopearlo aquí lo mantiene activo.
    //
    // Para pedir excepción: agregar el archivo a `ignores` con un comentario
    // que explique el motivo (form-table editable, sub-tabla read-only
    // estática, catálogo con toggles inline, etc.).
    // ─────────────────────────────────────────────────────────────────────
    name: "no-raw-table",
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      // Implementación misma del DataTable — consume las primitivas.
      "src/components/shared/DataTable.tsx",
      "src/components/shared/dataTable/**",
      // Form-tables editables con render row complejo (inputs/textareas por celda).
      "src/features/cotizacion/components/SeccionMercanciaAerea.tsx",
      "src/features/cotizacion/components/SeccionMercanciaMaritimaLCL.tsx",
      "src/features/cotizacion/components/TablaConceptosGenerico.tsx",
      "src/features/cotizacion/components/TablaCostosDetalle.tsx",
      // Sub-vistas read-only extraídas de FacturaConceptosTable (límite 200 líneas).
      "src/features/facturacion/components/detalle/FacturaConceptosRows.tsx",
      "src/features/portal/components/factura/PortalFacturaConceptosTable.tsx",
      "src/features/costeo/components/DemorasTarifaEditor.tsx",
      // Sub-tablas read-only estáticas (sin sort/paginación) — no requieren DataTable.
      "src/features/cotizacion/components/seccionMercancia/DimensionesLCLTable.tsx",
      "src/features/cotizacion/components/seccionMercancia/DimensionesAereasTable.tsx",
      "src/features/embarques/components/tabResumen/EmbarquesRelacionadosCard.tsx",
      "src/features/embarques/components/pnl/PnlProveedoresTable.tsx",
      "src/features/embarques/components/pnl/PnlComparativaTable.tsx",
      // Estado de cuenta: filas expandibles con sub-rows (pagos + notas de crédito),
      // patrón no soportado nativamente por DataTable.
      "src/features/facturacion/estadoCuenta/components/EstadoCuentaTable.tsx",
      // Catálogos con toggles inline por fila (patrón switch-per-row).
      "src/features/configuracion/components/CatalogoClavesSATCard.tsx",
      "src/features/configuracion/components/CatalogoClavesSATCard.parts.tsx",
      // Tests pueden importar primitivas para renders aislados.
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          {
            name: "@/components/ui/table",
            message: "Usa <DataTable /> de '@/components/shared/DataTable' + columnBuilders/defineColumns para estandarizar tablas. Excepciones: agrega el archivo a la allowlist del bloque `no-raw-table` en eslint.config.js con un comentario que explique el motivo.",
          },
        ],
      }],
    },
  },
  {
    // ─────────────────────────────────────────────────────────────────────
    // Guardrail `locale-format-legacy` — PR-5 · Ítem 3.4 (arq-4).
    //
    // Los archivos abajo aún usan `.toLocaleString()`, `.toLocaleDateString()`
    // o `new Intl.NumberFormat(...)` inline. Se migrarán en olas a los
    // formatters canónicos de `@/lib/formatters` (`formatCurrency`,
    // `formatNumber`, `formatDate`, `formatFechaEs`, `formatFechaHora`,
    // `formatFechaLarga`). Al migrar un archivo: quítalo de esta lista.
    // NO agregues archivos nuevos aquí — el guardrail existe para bloquear
    // regresiones.
    //
    // Este bloque redefine `no-restricted-syntax` con SÓLO los selectores
    // base + queryKey + IVA, omitiendo los selectores locale-format. En
    // ESLint flat-config el último bloque coincidente gana para esa regla.
    // ─────────────────────────────────────────────────────────────────────
    name: "locale-format-legacy",
    files: [
      // Formatters canónicos: definen los helpers, deben usar la API nativa.
      "src/lib/formatters/**",
      // Allowlist LEGACY — migrar en olas.
      "src/components/shared/bitacora/constants.ts",
      "src/features/admin/components/BackfillLegacyCard.tsx",
      "src/features/admin/components/DiagnosticoColumns.tsx",
      "src/features/admin/components/DiagnosticoHealthPanel.tsx",
      "src/features/admin/routes/AdminDemoLeads.tsx",
      "src/features/auditoria/hooks/useAuditoriaEjecutivo.ts",
      "src/features/auditoria/hooks/useAuditoriaPageController.ts",
      "src/features/costeo/components/CosteoRutasTable.tsx",
      "src/features/costeo/utils/tarifaFormatters.ts",
      "src/features/cotizacion/components/SeccionFleteManualLCL.tsx",
      "src/features/cotizacion/components/TarifaVinculadaPanel.tsx",
      "src/features/cotizacion/hooks/usePortalCotizacionDetalleController.ts",
      "src/features/crm/components/ActividadTimeline.tsx",
      "src/features/crm/components/ComentariosOportunidad.tsx",
      "src/features/crm/components/OportunidadKanban.tsx",
      "src/features/crm/components/crmDashboard/DealsCards.tsx",
      "src/features/crm/routes/Actividades.tsx",
      "src/features/crm/routes/LeadDetalle.tsx",
      "src/features/crm/routes/MiDia.tsx",
      "src/features/dashboard/hooks/useDashboardController.ts",
      "src/features/embarques/hooks/useEmbarquesPageController.ts",
      "src/features/operaciones/hooks/useOperacionesPageController.ts",
      "src/features/portal-agente/routes/_sections/agenteTarifasColumns.tsx",
      "src/features/proformas/components/AccionesProforma.tsx",
      // Tests: fixtures de fechas/números específicos.
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "no-restricted-syntax": ["error",
        ...NO_RESTRICTED_SYNTAX_BASE,
        ...QUERY_KEY_AND_IVA_RULES,
      ],
    },
  },
  // Bloque 2.3 (arquitectura): prohibir imports profundos cross-feature.
  ...crossFeatureOverrides,
);
