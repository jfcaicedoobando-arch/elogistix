import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { splitTestsByEnvironment } from "./scripts/lib/testEnvSplit";
import {
  aliasVitest,
  commonTest,
  MAX_WORKERS,
  NORMAL_EXCLUDE,
} from "./vitest.shared";

// v13.344.0 — Reparto por entorno. Medido en el sandbox: un archivo de
// guardrail en jsdom tarda ~25 s (13.8 s sólo en levantar el entorno + 3.1 s
// de `setup.ts`); los mismos tests en `node` bajan a ~3 s. ~580 de los ~850
// archivos nunca tocan el DOM, así que se les quita jsdom encima.
const ROOT = __dirname;
const SPLIT = splitTestsByEnvironment(ROOT);

// Alias compartido por ambos proyectos (los proyectos NO heredan el `resolve`
// raíz, así que se define una sola vez y se reutiliza).
const ALIAS = aliasVitest(ROOT);

// Config común a ambos proyectos (ver `vitest.shared.ts`). Los benchmarks
// (`*.perf.*`) quedan EXCLUIDOS aquí y sólo corren con `vitest.perf.config.ts`.
const COMMON_TEST = commonTest({ exclude: NORMAL_EXCLUDE });


export default defineConfig({
  plugins: [react()],
  test: {
    // Vitest 4: el pool y sus límites viven en COMMON_TEST (por proyecto).
    // Se conserva `maxWorkers` también en la raíz para que el límite global de
    // procesos concurrentes entre proyectos sea el mismo que antes.
    // Para cambiar shards/workers en CI hay que medir primero:
    // `bash scripts/bench-vitest-shards.sh` (ver docs/ci-vitest-shards.md).
    maxWorkers: MAX_WORKERS,


    projects: [
      {
        plugins: [react()],
        resolve: { alias: ALIAS },
        test: {
          ...COMMON_TEST,
          name: "node",
          environment: "node",
          setupFiles: ["./src/test/setup.node.ts"],
          include: SPLIT.node,
        },
      },
      {
        plugins: [react()],
        resolve: { alias: ALIAS },
        test: {
          ...COMMON_TEST,
          name: "jsdom",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          include: SPLIT.jsdom,
        },
      },
    ],
    // Reporter JUnit (12.85.0): además de los defaults, escribimos test-results.xml
    // para que dashboards externos (GitHub Actions test reporter, Jenkins, etc.)
    // puedan consumir resultados estructurados. Default + junit en paralelo para
    // no perder el output legible en consola.
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: { junit: "./reports/junit.xml" },

    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json", "json-summary", "lcov", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/",
        "src/test/",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/*.d.ts",
        "src/**/__tests__/**",
        "src/components/ui/**",
        "src/lib/utils.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/integrations/supabase/**",
        // 12.98.5 — Limpieza de denominador. Excluimos código puramente
        // declarativo/presentacional cuya cobertura no aporta valor:
        // - copy estático de marketing (sólo strings),
        // - definiciones de columnas de DataTable (JSX declarativo sin lógica),
        // - tipos puros (sólo type/interface).
        // La lógica real vive en hooks y utils que sí se testean.
        // 13.87.1 — copy/datos estáticos de marketing también viven bajo
        // features/marketing/routes (landingCopy, guia*.data, etc.).
        "src/features/marketing/**",
        "src/**/*Columns.{ts,tsx}",
        "src/**/*columns.{ts,tsx}",
        "src/types/**",
        // 13.85.7 — Páginas/rutas son orquestación JSX cubierta por E2E
        // (mem note: pages = thin orchestration; hooks/services tienen la lógica).
        // Excluirlas alinea el denominador con la realidad y permite sostener
        // ratchet 35%. Aplica a páginas legadas (src/pages) y a las nuevas
        // ubicaciones por feature (src/features/*/routes).
        // (auditoría 2026-07-24: se retiraron las exclusiones muertas
        // "src/pages/**" y "src/hooks/use-toast.ts" — esas rutas ya no
        // existen en el repo.)
        "src/features/*/routes/**/*.tsx",
        // Wrappers presentacionales sin lógica testeable unitariamente.
        "src/pdf/render/PdfPreview.tsx",
        "src/pdf/emisor.ts",
        // 13.85.10 (B2) — Limpieza de denominador.
        // Layout/chrome de la app: orquestación JSX cubierta por E2E.
        "src/components/layout/**",
        // Dialog shells presentacionales puros: sólo orquestan, sin
        // useState/useMutation/useForm/useReducer propios. La lógica vive
        // en hooks/forms hermanos que sí se testean.
        "src/components/shared/BulkImportDialog.tsx",
        "src/features/admin/components/NuevaOrganizacionDialog.tsx",
        "src/features/admin/routes/admin-org/RoleChangeAlertDialog.tsx",
        "src/features/auditoria/components/AsignarResponsableDialog.tsx",
        "src/features/auditoria/components/MarcarRevisadoDialog.tsx",
        "src/features/cliente/components/NuevoClienteDialog.tsx",
        "src/features/costeo/components/CosteoAgenteFormDialog.tsx",
        "src/features/cotizacion/components/detalle/EnviarCotizacionDialog.tsx",
        "src/features/crm/components/ImportarLeadsCsvDialog.tsx",
        "src/features/embarques/components/tracking/TrackingConfirmFechaLlegadaDialog.tsx",
        "src/features/facturacion/components/HuecoFacturacionDetalleDialog.tsx",
        "src/features/portal/components/cotizacion/PortalCotizacionConfirmDialog.tsx",
        "src/features/proveedor/components/EditarProveedorDialog.tsx",
        "src/features/proveedor/components/NuevoProveedorDialog.tsx",
        "src/features/proveedor/components/ProveedoresImportDialog.tsx",
      ],
      // Umbrales mínimos globales. POLÍTICA RATCHET: piso sube sólo cuando
      // coverage real ≥ umbral + 2%.
      // 13.85.7 — lines/statements 34→35, functions 48→50, branches 67→70.
      // 13.87.0 (B3) — functions 50→52 y branches 70→72.
      // 13.87.2 — lines/statements 35→38.
      // 13.135.69 — Revertido intento de bajar a 37 (ratchet).
      // 13.137.38 — Thresholds sólo en modo merge.
      // 13.141.3 — RECALIBRACIÓN por cambio de herramienta: con
      // vitest + @vitest/coverage-v8 v3.2.4 (versión instalada), la métrica v8
      // (AST-aware remapping) cuenta callbacks/arrow-fns y
      // branches implícitas distinto a versiones previas. Sin que prod ni tests
      // cambiaran, los reales cayeron Functions 56→32% y Branches 73→37%,
      // mientras Lines SUBIÓ 40→43%. Pisos a (real − 2 pts).
      //
      // 13.141.4 — PLAN DE RATCHET (acordado, ver
      // mem://principles/coverage-threshold):
      //   • Meta Q3 2026: functions 45 / branches 50.
      //   • Meta Q1 2027: functions 55 / branches 60.
      // Cada PR significativo en módulos core (CXP, facturación, embarques,
      // cotización) DEBE agregar tests dirigidos hasta llegar a la meta.
      // En local se puede activar `coverage.thresholds.autoUpdate=true` para
      // que Vitest proponga subir el piso cuando el real supere por 2 pts.
      // NO activar autoUpdate en CI (debe ser decisión humana documentada).
      thresholds: process.argv.some((a) => a.startsWith("--shard"))
        ? undefined
        : {
            lines: 38,
            statements: 38,
            functions: 30,
            branches: 34,
          },


    },
  },
  resolve: {
    alias: [
      ...RR_ESM,
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // Alias global: en tests, @react-pdf/renderer apunta a un stub ligero
      // (src/test/mocks/reactPdfStub.tsx). Evita cargar fontkit/pdfkit por
      // archivo. Aplica también a `vi.importActual("@react-pdf/renderer")`.
      {
        find: "@react-pdf/renderer",
        replacement: path.resolve(__dirname, "./src/test/mocks/reactPdfStub.tsx"),
      },
    ],
  },
});
