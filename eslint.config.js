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
  {
    // Sprint 4 · Ban `Intl.DateTimeFormat` fuera de `lib/formatters`.
    selector: "NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']",
    message: "Sprint 4: usa `formatFechaEs`/`formatFechaHora`/`formatFechaLarga` de `@/lib/formatters` en vez de `new Intl.DateTimeFormat(...)` inline.",
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
    // Sprint 2 · ítem 3 — cubre `queryKey: [...] as const` (TSAsExpression).
    // El selector base sólo matchea `ArrayExpression` directo; sin este selector
    // los hooks que anotan `as const` (patrón común para narrowear el tuple)
    // escapaban del guardrail.
    selector: "Property[key.name='queryKey'] > TSAsExpression > ArrayExpression",
    message: "No definas `queryKey` inline (incluye `[...] as const`). Usa el builder de `src/features/<dominio>/queryKeys.ts` (o `src/lib/query`).",
  },
  {
    selector: "Property[key.name='mutationKey'] > ArrayExpression",
    message: "No definas `mutationKey` inline. Declara la key en `queryKeys.ts` del dominio para poder referenciarla desde `useIsMutating`/DevTools.",
  },
  {
    // Sprint 2 · ítem 3 — cubre `mutationKey: [...] as const`.
    selector: "Property[key.name='mutationKey'] > TSAsExpression > ArrayExpression",
    message: "No definas `mutationKey` inline (incluye `[...] as const`). Declara la key en `queryKeys.ts` del dominio.",
  },
  {
    // Bloque 2.4 arquitectura — fuente única DB↔TS para el IVA. La tasa
    // 16% vive exclusivamente en `TASA_IVA` (src/lib/financial/financialUtils.ts).
    selector: "Literal[value=0.16]",
    message: "No hardcodees `0.16`. Importa `TASA_IVA` desde `@/lib/financial/financialUtils` o resuelve la tasa dinámica del concepto (`resolverTasaConcepto`). Ver mem://core (Never hardcode VAT).",
  },
  {
    // M3 (auditoría 2026-07-29) — un solo motor de redondeo de dinero.
    // `Math.round(x * 100) / 100` diverge de `ROUND(numeric, 2)` de Postgres
    // en negativos (half toward +∞ vs half away from zero).
    selector:
      "BinaryExpression[operator='/'][right.value=100] > CallExpression[callee.object.name='Math'][callee.property.name='round']",
    message:
      "No redondees dinero con `Math.round(x*100)/100`. Usa `roundMoney` (o `subtotalLinea`/`sumarMontos`) de `@/lib/financial/financialUtils` — política única half-away-from-zero, idéntica a Postgres ROUND.",
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
  // v13.488.0 — Cartera monta el diálogo de cobro en lote de facturación (CxC).
  "src/features/bandejas/routes/Cartera.tsx",
  "src/features/bandejas/routes/CxpPorCapturar.tsx",
  "src/features/cliente/routes/ClienteDetalle.tsx",
  // v13.343.0 — el panel 360 se movió a esta sección al dividir ClienteDetalle.
  "src/features/cliente/routes/_sections/ClienteDetalleTabs.tsx",
  "src/features/cliente/services/financials.ts",
  "src/features/compras/routes/ComprasPorAprobar.tsx",
  // Split de ComprasPorAprobar.tsx (límite 200 líneas): hereda su excepción.
  "src/features/compras/routes/ComprasPorAprobar.useColumnas.ts",
  "src/features/cotizacion/components/TarifaVinculadaPanel.tsx",
  "src/features/cotizacion/components/revalidacion/CrearEmbarqueConRevalidacion.tsx",
  "src/features/cotizacion/components/seccionRuta/OrigenDestinoBlock.tsx",
  "src/features/cotizacion/components/seccionRuta/SugerenciasTarifaInline.tsx",
  // Extraídos de SugerenciasTarifaInline (refactor de complejidad): heredan su excepción legacy.
  "src/features/cotizacion/components/seccionRuta/SugerenciasTarifaResultados.tsx",
  "src/features/cotizacion/components/seccionRuta/SugerenciasTarifaSinIds.tsx",
  "src/features/dashboardEjecutivo/components/BandaKPIs.tsx",
  "src/features/dashboardEjecutivo/services/types.ts",
  "src/features/embarques/components/TabSeguros.tsx",
  "src/features/embarques/components/conceptos/ConceptoCatalogoSelect.tsx",
  "src/features/embarques/components/stepDatosRuta/StepDatosRutaMaritimo.tsx",
  "src/features/embarques/domain/embarqueWizard.ts",
  "src/features/embarques/domain/mappers/embarqueToDb.ts",
  "src/features/embarques/hooks/useHidratacionEditarEmbarque.ts",
  "src/features/embarques/hooks/useUmbralesReconciliacion.ts",
  "src/features/embarques/services/submitProformaDialog.ts",
  "src/features/portal-agente/components/AgenteLayout.tsx",
  "src/features/portal-agente/components/AgenteTarifaForm.tsx",
  "src/features/portal-agente/routes/AgenteGarantias.tsx",
  "src/features/portal/components/EmbarqueCard.tsx",
  "src/features/portal/components/dashboard/PortalEmbarquesRecientesCard.tsx",
  
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
  // O5 (auditoría 2026-07-29, S3-14): imports ya colados por el hueco de
  // utils/ y constants/ al ampliar la regla cross-feature. Mismo burn-down:
  // salen promoviendo el helper a src/lib/ o duplicándolo en el consumidor.
  // Candidatos de promoción: cotizacion/utils/resolveTipoContenedorNombre
  // (5 consumidores cross, incl. src/pdf y src/generators) y
  // auditoria/utils/diffFields (4 consumidores en 3 features).
  // v13.618.0 — El buzón maestro CxP reutiliza `CorregirDatosEntranteDialog`
  // (vive en embarques/components/entrantes junto a sus 4 subcomponentes).
  // Sale del allowlist cuando se promueva la familia `entrantes/` a shared.
  "src/features/bandejas/components/BuzonEntrantesModales.tsx",
  "src/features/cliente/hooks/useClienteDetalleHandlers.ts",
  "src/features/embarques/components/contenedores/SeccionContenedoresReadonly.tsx",
  "src/features/embarques/components/tabResumen/RutaPorModo.tsx",
  "src/features/embarques/hooks/useEditarEmbarqueWizard.helpers.ts",
  "src/features/embarques/hooks/useEditarEmbarqueWizard.ts",
  "src/features/portal-agente/routes/AgenteInicio.tsx",
  "src/features/proveedor/hooks/useProveedorDetalleController.ts",
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
        {
          group: [`@/features/${f}/utils/*`, `@/features/${f}/utils/**`],
          message: `Cross-feature: no importes de '${f}/utils'. Promueve el helper a 'src/lib/' o duplícalo en tu feature. Ver Bloque 2.3 y O5 (auditoría 2026-07-29).`,
        },
        {
          group: [`@/features/${f}/constants/*`, `@/features/${f}/constants/**`],
          message: `Cross-feature: no importes de '${f}/constants'. Promueve la constante a 'src/constants/'. Ver Bloque 2.3 y O5.`,
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
      // 13.274.0 — Estándares React 19. RTC-02: el plugin de build del
      // Compiler se retiró (Ola 11); esta regla queda sólo como guardia
      // estática de "rules of react", en modo warn para no explotar CI con
      // las 3 violaciones históricas conocidas (ver
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
      // de bajo valor). Sprint 2 · ítem 2.7 (cierre): promovido warn→error.
      // Tests, columnas de tabla y otros patrones legítimos tienen overrides
      // dedicados que apagan la regla — ver bloques más abajo.
      "complexity": ["error", { max: 16 }],
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
      // `previewAuthStorage.ts` es autogenerado por la plataforma (prohibido
      // editarlo), así que sus reglas de estilo se relajan aquí.
      "prefer-const": "off",
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
          // Sprint 1 (R3) · 0.5-b — Cierre del boundary `src/lib/**` → `@/features/**`.
          // Migración escalonada en Sprint 3+ para los 12 archivos ARCH-DEBT
          // (registry de queryKeys, contextos de auth, filenames de PDF,
          // mappers UI) que hoy violan la regla; ver bloque de excepciones abajo.
          {
            group: ["@/features/*", "@/features/**"],
            message: "lib/ no puede importar de features/. Invierte la dependencia: el feature llama al util de lib/ o expón el tipo desde src/types/.",
          },
        ],
      }],
    },
  },
  {
    // ARCH-DEBT (Sprint 1 · 0.5-b): allowlist temporal para los 12 archivos
    // que ya importan `@/features/**` desde `src/lib/**`. Reconfigura el
    // ban de lib/ SIN el patrón features (los otros bans se mantienen).
    // Sprint 3+ retira estos archivos migrando sus dependencias.
    files: [
      "src/lib/auth/signOut.ts",
      "src/lib/contexts/AuthContext.tsx",
      "src/lib/contexts/OrganizationContext.tsx",
      "src/lib/contexts/auth/useAuthProfile.ts",
      "src/lib/contexts/auth/useAuthSession.ts",
      "src/lib/contexts/auth/useLoginAudit.ts",
      "src/lib/csv/leadsCsv.ts",
      "src/lib/filenames.ts",
      "src/lib/mappers/estadoResultadosRows.ts",
      "src/lib/query/index.ts",
      "src/lib/ui/appFeedback.ts",
      "src/lib/ui/uiMappings.ts",
    ],
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
      // Burn-down verificado (R3): FacturasMasivasToolbar, dashboardEjecutivo
      // y facturapi-emitir ya no violan; quedan fuera. Solo persiste
      // facturapi-cancelar (CC=35, pendiente de split).
      "supabase/functions/facturapi-cancelar/index.ts",
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
    // Guardrail `no-raw-table` + `no-direct-sonner` — design system.
    //
    // 1. `@/components/ui/table` (primitivas shadcn) — usar `<DataTable />`
    //    de `@/components/shared/DataTable` + builders.
    // 2. `sonner` directo (Sprint 4) — usar `notifyError`/`notifySuccess`/
    //    `notifyInfo` de `@/lib/ui/appFeedback` (wrapper con Sentry breadcrumbs
    //    + diagnóstico) o `useToast` de `@/hooks/shared`. Baseline temporal
    //    de 82 archivos + 6 wrappers en `SONNER_LEGACY_ALLOWLIST` (burn-down).
    //
    // Este bloque va aparte porque el override de `src/features/**` apaga
    // `no-restricted-imports` completo; scopearlo aquí lo mantiene activo.
    // ─────────────────────────────────────────────────────────────────────
    name: "no-raw-table-and-sonner",
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      // Implementación misma del DataTable — consume las primitivas.
      "src/components/shared/DataTable.tsx",
      "src/components/shared/dataTable/**",
      // Contrato visual para tablas de detalle: envuelve TableHead/TableRow/TableCell.
      "src/components/shared/DetailTable.tsx",
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
      "src/features/embarques/components/pnl/PnlProveedoresTable.tsx",
      "src/features/embarques/components/pnl/PnlComparativaTable.tsx",
      // Estado de cuenta: filas expandibles con sub-rows (pagos + notas de crédito),
      // patrón no soportado nativamente por DataTable.
      "src/features/facturacion/estadoCuenta/components/EstadoCuentaTable.tsx",
      // Sub-vistas extraídas de EstadoCuentaTable (límite 200 líneas).
      "src/features/facturacion/estadoCuenta/components/EstadoCuentaFilaFactura.tsx",
      "src/features/facturacion/estadoCuenta/components/EstadoCuentaGrupoMoneda.tsx",
      "src/features/facturacion/estadoCuenta/components/EstadoCuentaTableHead.tsx",
      // Renglón editable de conceptos extraídos por IA (inputs por celda).
      "src/features/cxp/components/CfdiConceptoIaRow.tsx",
      // Catálogos con toggles inline por fila (patrón switch-per-row).
      "src/features/configuracion/components/CatalogoClavesSATCard.tsx",
      "src/features/configuracion/components/CatalogoClavesSATCard.parts.tsx",
      // Detalle del pago: tabla read-only con colspans y pie de totales aplicados.
      "src/features/tesoreria/components/DetallePagoAplicaciones.tsx",
      // Tabla estática de 2 renglones (flujo por moneda) en dashboard de tesorería.
      "src/features/tesoreria/routes/_sections/TesoreriaFlujoMonedas.tsx",
      // Pagos programados: <DataTable /> + pie de totales (TableRow/TableCell con colSpan).
      "src/features/tesoreria/routes/_sections/PagosProgramadosTablas.tsx",
      // Comparativas read-only "original vs nueva" / "antes → después" sobre
      // DetailTable (2 columnas, sin sort/paginación): DataTable no aplica.
      "src/features/facturacion/components/refacturacion/ComparativoConsistencia.tsx",
      "src/features/facturacion/components/refacturacion/RefacturacionPreviewSaldos.tsx",
      // CRM: editores con inputs por celda y tabla de higiene read-only compacta.
      "src/features/crm/components/MetasActividadEditor.tsx",
      "src/features/crm/components/PresupuestoCrmEditor.tsx",
      "src/features/crm/components/higiene/HigieneTabla.tsx",
      // Estado de resultados: subtotales con colSpan y fila de margen con
      // fondo propio — patrón no soportado por <DataTable />.
      "src/features/profit/components/EstadoResultadosTable.tsx",
      // Presupuesto: grid editable (inputs por celda) y comparativo con
      // encabezado ordenable + barra de cumplimiento por fila.
      "src/features/presupuesto/components/TabCaptura.tsx",
      "src/features/presupuesto/components/TabVsReal.tsx",
      // Sub-vistas de TabVsReal extraídas por el límite de 200 líneas.
      "src/features/presupuesto/components/VsRealCuerpo.tsx",
      "src/features/presupuesto/components/VsRealFila.tsx",
      // Flujo semanal de tesorería: filas expandibles con colSpan por semana.
      "src/features/tesoreria/components/TablaFlujoSemanal.tsx",


      // Ola 5.2 — tablas de detalle migradas de `<table>` crudo a primitivas.
  "src/components/shared/LoteRenglonesTable.tsx",
  "src/features/admin/components/MigrarRolesLegacyPreviewTable.tsx",
  "src/features/admin/components/diagnosticoHealth/HealthSlowestTable.tsx",
  "src/features/admin/routes/AdminDemoLeads.tsx",
  "src/features/anticipos-proveedor/components/AnticiposAplicadosSection.tsx",
  "src/features/compras/routes/_sections/ConciliacionDetalleCuerpoTabla.tsx",
  "src/features/compras/routes/_sections/ConciliacionDetalleFilaRenglon.tsx",
  "src/features/cotizacion/components/plantillas/PlantillasTabla.tsx",
  "src/features/cotizacion/components/revalidacion/RevalidarTarifaModal.tsx",
  "src/features/cotizacion/routes/CotizacionInformativaDetalle.tsx",
  "src/features/crm/components/ImportarLeadsCsvPreview.tsx",
  "src/features/crm/components/OportunidadCotizacionesList.tsx",
  "src/features/crm/routes/Analitica.tsx",
  "src/features/crm/routes/CrmDashboard.tsx",
  "src/features/cxp/components/CfdiConceptosPreview.tsx",
  "src/features/cxp/components/ConceptosFacturaSection.tsx",
  "src/features/cxp/components/DialogDetallePagosProveedor.fila.tsx",
  "src/features/cxp/components/DialogDetallePagosProveedor.sections.tsx",
  "src/features/cxp/components/DialogPagoLoteRenglones.tsx",
  "src/features/cxp/components/NotaCreditoFila.tsx",
  "src/features/cxp/components/NotasCreditoSection.tsx",
  "src/features/dashboardEjecutivo/components/SaldosBancosCard.tsx",
  "src/features/embarques/components/OrigenCostosSection.tsx",
  "src/features/embarques/components/contenedores/SeccionContenedoresReadonly.tsx",
  "src/features/embarques/components/costos/GrupoCostosProveedor.tsx",
  "src/features/facturacion/components/CobroLoteRenglon.tsx",
  "src/features/facturacion/components/NotasCreditoRecientes.tsx",
  "src/features/facturacion/estadoCuenta/components/EstadoCuentaRowExpanded.tsx",
  "src/features/marketing/routes/GuiaPuertosMexicoArticle.tsx",
  "src/features/proformas/components/portal/PortalProformaResumen.tsx",

      // Tests pueden importar primitivas para renders aislados.
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      // Wrappers autorizados de `sonner` — la implementación de referencia.
      "src/lib/ui/appFeedback.ts",
      "src/lib/ui/appFeedback.notices.ts",
      "src/lib/ui/__tests__/**",
      "src/hooks/shared/useToast.ts",
      "src/hooks/shared/useCopyText.ts",
      // shadcn Toaster primitive + diálogo de error usa `toast()` directo.
      "src/components/ui/sonner.tsx",
      "src/components/ui/ErrorDetailsDialog.tsx",
      // ── SONNER-LEGACY (Ola B · burn-down completo v13.320.15) ─────────────
      // Baseline vacía: todos los call sites migrados a `notify*` de
      // `@/lib/ui/appFeedback`. La regla se mantiene para bloquear regresiones.
      // NO agregar entradas nuevas.
    ],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          {
            name: "@/components/ui/table",
            message: "Usa <DataTable /> de '@/components/shared/DataTable' + columnBuilders/defineColumns para estandarizar tablas. Excepciones: agrega el archivo a la allowlist del bloque `no-raw-table-and-sonner` en eslint.config.js con un comentario que explique el motivo.",
          },
          {
            name: "sonner",
            message: "Sprint 4: no importes `sonner` directo. Usa `notifyError`/`notifySuccess`/`notifyInfo` de `@/lib/ui/appFeedback` (wrapper con diagnóstico) o `useToast` de `@/hooks/shared`. Excepciones sólo en la baseline SONNER-LEGACY (burn-down).",
          },
        ],
      }],
    },
  },
  {
    // ─────────────────────────────────────────────────────────────────────
    // Guardrail `locale-format-legacy` — PR-5 · Ítem 3.4 (arq-4).
    //
    // Allowlist AGOTADA (v13.309.32): todos los archivos legacy fueron
    // migrados a los formatters canónicos de `@/lib/formatters`. Este
    // bloque queda SOLO para los propios formatters, que necesitan usar la
    // API nativa (`toLocaleString`/`toLocaleDateString`/`Intl.NumberFormat`)
    // porque ellos son la implementación de referencia.
    //
    // Si aparece una nueva violación en código de aplicación: NO agregarla
    // aquí. Migrar el archivo al formatter apropiado (`formatFechaEs`,
    // `formatFechaHora`, `formatFechaLarga`, `formatCurrency`,
    // `formatNumber`) o extender el formatter si falta un caso.
    // ─────────────────────────────────────────────────────────────────────
    name: "locale-format-legacy",
    files: [
      // Formatters canónicos: definen los helpers, deben usar la API nativa.
      "src/lib/formatters/**",
      // Primitivas TZ-aware CDMX (`hoyMx`, `ymMx`): capa de bajo nivel que
      // implementa los formatters de dominio con `Intl.DateTimeFormat("en-CA", ...)`.
      "src/lib/date/mx.ts",
      "src/lib/date/mxDatetimeLocal.ts",
    ],
    rules: {
      "no-restricted-syntax": ["error",
        ...NO_RESTRICTED_SYNTAX_BASE,
        ...QUERY_KEY_AND_IVA_RULES,
      ],
    },
  },

  // Lote B (retícula espacial 8/16/24): prohíbe padding/margin/gap/space
  // arbitrarios (px o rem) dentro de literales de className. Usa la escala de
  // Tailwind (p-2/p-3/p-4/p-6, gap-2/gap-4/gap-6, mt-1/mt-2/mt-4, etc.) en vez
  // de valores "mágicos" como `p-[13px]`. También prohíbe colores crudos
  // (`bg-[#0B1B3A]`, `text-[hsl(160 84% 39%)]`): deben venir de tokens
  // semánticos del tema. Ámbito acotado a features/components para no bloquear
  // CI por casos legítimos en primitivas `ui/` o `pdf/`.
  {
    name: "spacing-grid/no-arbitrary-px",
    files: ["src/features/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: [
      "src/components/ui/**",
      "src/components/shared/dataTable/columnWidths.ts",
      "**/*columns.{ts,tsx}",
      "**/*Columns.{ts,tsx}",
      "**/__tests__/**",
      // Página interna de QA de marca: simula lienzos fijos de la identidad.
      "src/features/marketing/routes/LogoPreview.tsx",
    ],
    rules: {
      "no-restricted-syntax": ["error",
        {
          selector:
            "Literal[value=/(^|\\s)(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y)-\\[[0-9.]+(px|rem)\\](\\s|$)/]",
          message:
            "No uses paddings/gaps/márgenes arbitrarios (p-[..px], gap-[..px], mt-[..rem], space-y-[..px]). Usa la escala de espaciado de Tailwind (p-2, p-4, gap-4, mt-2, etc.) redondeando al múltiplo de 8/16/24 más cercano.",
        },
        {
          selector:
            "TemplateElement[value.raw=/(^|\\s)(p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y)-\\[[0-9.]+(px|rem)\\](\\s|$)/]",
          message:
            "No uses paddings/gaps/márgenes arbitrarios en px/rem dentro de template literals. Usa la escala de espaciado de Tailwind.",
        },
        {
          selector: "Literal[value=/-\\[(#[0-9a-fA-F]{3,8}|hsl\\(|rgba?\\()/]",
          message:
            "No uses colores crudos en clases arbitrarias (bg-[#0B1B3A], text-[hsl(...)]). Usa tokens semánticos del tema (bg-primary, text-success, border-border) o, para gráficas, `CHART` de @/lib/chartTokens.",
        },
        {
          selector: "TemplateElement[value.raw=/-\\[(#[0-9a-fA-F]{3,8}|hsl\\(|rgba?\\()/]",
          message:
            "No uses colores crudos en clases arbitrarias dentro de template literals. Usa tokens semánticos del tema.",
        },
        {
          // UX-16 — `text-[11px]` ≡ `text-label` (0.6875rem, Ola 8). El token
          // ya existe en tailwind.config.ts; los 5 usos residuales se migraron.
          selector: "Literal[value=/(^|\\s)text-\\[11px\\](\\s|$)/]",
          message:
            "UX-16: no uses `text-[11px]`. Usa el token `text-label` (0.6875rem) de la escala tipográfica.",
        },
        {
          selector: "TemplateElement[value.raw=/(^|\\s)text-\\[11px\\](\\s|$)/]",
          message:
            "UX-16: no uses `text-[11px]` en template literals. Usa el token `text-label`.",
        },
        {
          // UX-24 — z-index arbitrarios (z-[5], z-[60]…). Usa la escala
          // semántica de tailwind.config.ts: z-sticky(5) < z-header(40) <
          // z-overlay(50) < z-toast(60) < z-sentry(70).
          selector: "Literal[value=/(^|\\s)(!?z)-\\[[0-9]+\\](\\s|$)/]",
          message:
            "UX-24: no uses z-index arbitrarios (z-[N]). Usa la escala semántica del tema: z-sticky, z-header, z-overlay, z-toast, z-sentry (tailwind.config.ts → zIndex).",
        },
        {
          selector: "TemplateElement[value.raw=/(^|\\s)(!?z)-\\[[0-9]+\\](\\s|$)/]",
          message:
            "UX-24: no uses z-index arbitrarios (z-[N]) en template literals. Usa la escala semántica (z-sticky/z-header/z-overlay/z-toast/z-sentry).",
        },
      ],
    },
  },


  // Bloque 2.3 (arquitectura): prohibir imports profundos cross-feature.
  ...crossFeatureOverrides,

  {
    // ─────────────────────────────────────────────────────────────────────
    // Guardrail `no-legacy-estado-color` — UX-03 (design system).
    //
    // `getEstadoColor` fue ELIMINADO de `@/lib/ui/uiMappings` (UI-3,
    // v13.683.0): baseline legacy en cero. El componente canónico es
    // `StatusBadge` (src/components/shared/StatusBadge.tsx) sobre
    // statusRegistry/estadoConfig. La regla se mantiene como lápida para que
    // nadie reintroduzca el helper. Este bloque va al final para que el
    // override de `src/features/**` no lo neutralice.
    // ─────────────────────────────────────────────────────────────────────
    name: "no-legacy-estado-color",
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      // Implementación del wrapper legacy y su spec.
      "src/lib/ui/uiMappings.ts",
      "src/lib/ui/__tests__/**",
      // Tests pueden importar el helper para renders aislados.
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          {
            name: "@/lib/ui/uiMappings",
            importNames: ["getEstadoColor"],
            message: "UI-3: `getEstadoColor` fue eliminado. Usa <StatusBadge estado={...} /> ('@/components/shared/StatusBadge') o `getEstadoVisual(estado).badge` de '@/lib/ui/estadoConfig'. El helper fue eliminado en v13.683.0: no lo reintroduzcas.",
          },
        ],
      }],
    },
  },
  {
    // ── OLA 5 · a11y: <Input> sin etiqueta accesible ─────────────────────
    // `<Input>` (shadcn) no asocia <label> por sí solo: exigimos `id`
    // (para emparejar con <Label htmlFor>) o `aria-label`. El patrón
    // recomendado es `<FormField label="...">` (@/components/shared/FormField),
    // que genera el id con useId y lo inyecta en el primer hijo.
    //
    // `eslint-plugin-jsx-a11y` NO está instalado; cuando se instale, sustituir
    // este guardrail por `jsx-a11y/control-has-associated-label` (más completo:
    // cubre textarea/select y roles). Mientras tanto se usa
    // `no-restricted-syntax` con selector esquery.
    //
    // Nivel "warn" + scoped a src/features: existe deuda legacy (cientos de
    // `<Input>` sin id/aria-label) y subir a "error" rompería `bun run lint`.
    // Burn-down: cuando el conteo llegue a 0, subir a "error" y ampliar a src/**.
    name: "a11y-input-label",
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["warn",
        {
          selector:
            "JSXOpeningElement[name.name='Input']:not(:has(JSXAttribute[name.name='id'])):not(:has(JSXAttribute[name.name='aria-label'])):not(JSXElement[openingElement.name.name='FormField'] > JSXElement > JSXOpeningElement)",
          message:
            "a11y: <Input> requiere `id` (con <Label htmlFor={id}>) o `aria-label`; lo más simple es envolverlo en <FormField label=\"...\">. Ver bloque `a11y-input-label` en eslint.config.js.",
        },
      ],
    },
  },
);
