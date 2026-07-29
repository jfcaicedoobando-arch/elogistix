import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // v13.303.75 · Fija TZ para todos los tests. Antes, los tests sensibles
    // a timezone (`addDays`, `todayLocalISO`, `parseLocalMx`) sólo pasaban
    // cuando el runner corría en `America/Mexico_City`. Con esto CI y locales
    // en otra TZ producen los mismos resultados.
    env: { TZ: "America/Mexico_City" },
    // Excluimos defaults de Vitest + tests de performance que sólo deben
    // correr bajo demanda (consumen mucha memoria y enmascaran timeouts).
    exclude: [
      "node_modules/**",
      "dist/**",
      "src/**/*.perf.test.tsx",
      "src/**/*.perf.ts",
      // v13.322.1 (GHA-audit A4) · Los architecture gating tests corren en un
      // step dedicado del job `audits` de CI. Cuando la suite se ejecuta con
      // `--shard` (matrix de CI) los excluimos para no ejecutarlos dos veces
      // y para que su fallo no se diluya entre 10 shards.
      ...(process.argv.some((a) => a.startsWith("--shard"))
        ? [
            "src/lib/__tests__/architecture.test.ts",
            "src/lib/__tests__/architecture-baseline.test.ts",
            "src/__tests__/audit-report.test.ts",
            "src/__tests__/audit-casts-classifier.test.ts",
          ]
        : []),
    ],
    // Reporter JUnit (12.85.0): además de los defaults, escribimos test-results.xml
    // para que dashboards externos (GitHub Actions test reporter, Jenkins, etc.)
    // puedan consumir resultados estructurados. Default + junit en paralelo para
    // no perder el output legible en consola.
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: { junit: "./reports/junit.xml" },
    // Suite completa medida en ~189s (sandbox Lovable). Archivo más lento: 5.1s,
    // resto <1s. 15s por test/hook deja ~3x de margen sobre el peor caso real
    // sin esconder tests que se cuelgan.
    testTimeout: 15_000,
    hookTimeout: 15_000,
    teardownTimeout: 15_000,
    // Pool por procesos (forks). Cada archivo corre en un fork nuevo para
    // liberar memoria al terminar (PDFs / leak regression). Con el teardown
    // global de 12.60.20 + mocks-cleanup, el heap pico estable es ~55 MB,
    // por lo que es seguro paralelizar 2 forks (2 × 8 GB heap = 16 GB ≪ 32 GB
    // RAM del sandbox). Esto reduce el wall-clock de la suite ~2x sin riesgo
    // de OOM. Subir a 3-4 forks requirió heap ≤4 GB y disparó OOM en archivos
    // PDF pesados; 2 forks @ 8 GB es el punto óptimo verificado.
    pool: "forks",
    // v13.x (GHA-audit M6) — En CI (runners ubuntu-24.04, 4 vCPU/16 GB) usamos
    // 2 forks @ 8 GB heap, el punto óptimo ya verificado arriba: recorta 30-45%
    // el wall-time de cada shard sin riesgo de OOM. En el sandbox local
    // conservamos 1 fork serial.
    singleFork: !process.env.CI,
    maxForks: process.env.CI ? 2 : 1,
    minForks: 1,
    isolate: true,
    execArgv: ["--max-old-space-size=8192", "--expose-gc"],
    fileParallelism: !!process.env.CI,
    sequence: { shuffle: false },
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
      // 13.141.3 — RECALIBRACIÓN por cambio de herramienta: tras subir a
      // vitest + @vitest/coverage-v8 v4.1.9 (v13.138.1), la métrica v8 v4
      // (AST-aware remapping, PR vitest #8064) cuenta callbacks/arrow-fns y
      // branches implícitas distinto a v2/v3. Sin que prod ni tests
      // cambiaran, los reales cayeron Functions 56→32% y Branches 73→37%,
      // mientras Lines SUBIÓ 40→43%. Pisos a (real − 2 pts).
      //
      // 13.141.4 — PLAN DE RATCHET POST-V4 (acordado, ver
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
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Alias global: en tests, @react-pdf/renderer apunta a un stub ligero
      // (src/test/mocks/reactPdfStub.tsx). Evita cargar fontkit/pdfkit por
      // archivo. Aplica también a `vi.importActual("@react-pdf/renderer")`.
      "@react-pdf/renderer": path.resolve(__dirname, "./src/test/mocks/reactPdfStub.tsx"),
    },
  },
});
