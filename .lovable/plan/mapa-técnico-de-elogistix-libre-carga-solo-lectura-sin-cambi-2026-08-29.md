# Mapa técnico de Elogistix / Libre Carga (solo lectura, sin cambios)

Documento de onboarding para otro agente. Nada se modificó.

## 1. Stack y arranque
- React 18 + Vite 5 + TS 5 (strict), Tailwind 3, react-router-dom 6, TanStack Query, nuqs, Sentry, `@react-pdf/renderer`.
- Entradas: `src/main.tsx` → `src/App.tsx` (ErrorBoundary raíz, TooltipProvider, Toaster, BrowserRouter, NuqsAdapter, BreadcrumbProvider) → `src/routes.tsx`.
- Backend: Supabase (Lovable Cloud). Cliente autogenerado en `src/integrations/supabase/client.ts` y `types.ts` (no editar).

## 2. Rutas y módulos
- `src/routes.tsx` compone: `portalRoutes` (portal cliente), `agenteRoutes`, `adminRoutes`, `appRoutes` (+ `crmRoutes`), `publicRoutes`.
- `src/routes/appRoutes.lazy.ts`: todas las páginas en `React.lazy`. Páginas viven en `src/features/<dominio>/routes/*.tsx`.
- Helper `guarded(roles, element)` en `appRoutes.tsx` envuelve en `ProtectedRoute`; roles por módulo en `src/lib/access/roleRouteMatrix.ts` (whitelist positiva: lo no listado se deniega — M11).
- Rutas legacy con redirect que preserva querystring: `src/routes/RedirectPreserveSearch.tsx` (`/cxp→/compras/facturas`, `/proveedores→/compras/proveedores`, `/cartera→/cobranza`).
- ~45 features: cotizacion, embarques, proformas, facturacion, cxc, cxp, compras, tesoreria, comisiones, anticipos-proveedor, auditoria, crm, dashboard(+Ejecutivo), portal, portal-agente, costeo, catalogos, admin, configuracion, reportes, profit, presupuesto, operaciones, bandejas, search, notificaciones, onboarding, marketing, legal.

## 3. Capas y convenciones (forzadas por tests)
- Jerarquía: Pages → Hooks → Services → Domain/Lib. `src/lib/**` y `features/*/{domain,services}` no pueden importar hooks/components/pages.
- Acceso a Supabase solo desde `services` (allowlist para `lib/contexts/auth|organization`).
- Superficie pública por feature vía barrel `index.ts` (`feature-barrel-surface.test.ts` con baseline en burn-down).
- Tests guardianes: `src/lib/__tests__/architecture.test.ts`, `architecture-baseline.test.ts` (archivos >200 líneas, "Power of 10"), `src/__tests__/architecture/*-ratchet.test.ts`.
- `as unknown as` solo en `src/lib/supabase/cast.ts` (`fromDb`, `fromDbChecked`, `toDbJson`); fuera de ahí requiere marcador `// SAFE-CAST:`.
- Query keys centralizadas: `features/*/queryKeys.ts` re-exportadas en `src/lib/query/index.ts`; cliente único en `src/lib/query/queryClient.ts` (staleTime 60s, retry 2 + backoff, reporte global de errores).
- UI obligatoria: `FormDialogShell` (+ `FormDialogSection`/`Stepper`) para modales de formulario; `DataTable`/`ResponsiveDataTable`/`VirtualDataTable` para listados; PDFs en `src/pdf/documents/*` con `src/pdf/render/descargarPdf.ts`. Prohibido color hardcodeado y `style={{}}` (ver `docs/design-system.md`, reglas ESLint propias).

## 4. Auth y multi-tenant
- `src/lib/contexts/AuthContext.tsx`: `effectiveRole`; `super_admin` es rol de plataforma y se anula si aparece en `organization_members` (M1). Purga caché al detectar cambio de usuario (EC-01) y limpia borradores con P&L en `signOut`.
- `src/lib/contexts/OrganizationContext.tsx` + `organization/useSuperAdminOrgs.ts`: tenant activo del super admin (`queryClient.clear()` antes y después de cambiar de tenant).
- Guardas: `features/auth/components/ProtectedRoute.tsx` (fail-closed → `/sin-acceso`), `PortalProtectedRoute` (rol `cliente`), `AgenteProtectedRoute` (rol `agente_carga`).
- Permisos: `src/lib/access/permissionMatrix*.ts` — la lista de quién ve costos/márgenes debe reflejar exactamente la función SQL `puede_ver_costos_cotizacion()` (riesgo de drift).
- Backend: `user_roles` (global, aquí vive `super_admin`) vs `organization_members` (rol por org); `has_role`, `has_role_in_org`, `roles_jerarquia`, `org_scope()` (resuelve tenant activo desde `super_admin_org_activa`), `rls_tenant_scope_ok`.

## 5. Base de datos y RLS
- `supabase/migrations/` ≈1178 archivos `YYYYMMDDHHMMSS_*.sql`; manifiesto por release en `supabase/releases/migration-manifest.json`.
- `supabase/schema/baseline.sql` (~32.6k líneas) = DDL/estado de referencia; `supabase/schema/<dominio>/*.sql` = fuente canónica reviewable de funciones muy redefinidas (ver `supabase/schema/README.md`).
- ~93 políticas `AS RESTRICTIVE` "Scope tenant activo super admin": toda tabla nueva con `organization_id` debe incluirla o el super admin verá todos los tenants.
- Soft delete: `soft_delete_record()` (whitelist de tablas + scope de org + roles) y trigger global `_guard_soft_delete()`; lecturas deben filtrar `deleted_at is null` (ratchet `audit:soft-delete`).
- `supabase/tests/fix45_anon_execute_whitelist.sql`: cualquier función SECURITY DEFINER ejecutable por `anon` debe estar en whitelist y llevar `check_ratelimit`.
- ~165 RPCs invocadas desde el frontend (embarques, cotizaciones, facturación, CXP/CXC, tesorería, comisiones, auditoría, portal). La lógica de negocio pesada vive en RPC, no en el cliente.

## 6. Edge Functions e integraciones (60 en `supabase/functions/`)
- FacturAPI: `facturapi-emitir`, `-emitir-rep`, `-emitir-nota-credito`, `-cancelar*`, `-consultar*`, `-descargar(-zip)`, `-webhook` (`?org=`), `-reconciliar-cancelaciones`, `-recuperar-claim`, `-test-conexion`.
- IA (Lovable AI Gateway/Gemini): `parse-cfdi-xml`, `parse-csf`, `parse-invoice-pdf`, `auditoria-explicar-hallazgo`.
- Email (Resend vía gateway): `send-transactional-email`, `process-email-queue`, `enviar-{cotizacion,factura,proforma}-email`, `cxc-recordatorios*`, `auth-email-hook`, `handle-email-{suppression,unsubscribe}`.
- SAT/DOF/otros: `verificar-uuid-sat`, `verificar-sat-lote|semanal`, `rep-retry-nocturno`, `tc-dof-diario` (Banxico SIE), `exchange-rates`, `tracking-public`, `client-error-log`, `sentry-tunnel`, `user-management`, `demo-access`, `e2e-provision-*`.
- Helpers en `_shared/`: `auth.ts`, `cors.ts`, `sentry.ts` (`wrapEdgeHandler`), `facturapiAuth/Client`, `cfdiParser`, `cronLock`, `ratelimit`, `redact` (PII), plantillas de email. `verify_jwt=false` solo para los webhooks listados en `supabase/config.toml`.

## 7. Núcleo fiscal/financiero (`src/lib/financial/*`)
- `financialUtils.ts`: `roundMoney` half-away-from-zero (paridad con `ROUND(numeric,2)`), `TASAS_IVA_MX` 0/8/16, `resolverTasaConcepto`. `convertirAMXN/USD` están **deprecadas** (asumen TC=1).
- `convertir.ts` es el canon de conversión (`aMxn`, `sumarEnMxn`, `excluidoPorMoneda`); `tcValido.ts` prohíbe TC=1 en moneda extranjera; `tcPar.ts` fija "quote por 1 base"; `tcBanda.ts` banda 5–40 MXN/USD; `saldoFactura.ts` (`saldo = max(0, total − pagos − NC)`, estados terminales → 0); `toleranciaPago.ts` (0.005).
- Retenciones ISR/IVA para REP: `functions/facturapi-emitir-rep/retencionesDr.ts` (bloquea tasas mixtas).
- Flujo comercial: cotización (`features/cotizacion/services/mutations/*`) → embarque (`crear_embarque_borrador_desde_cotizacion`, `avanzar_estado_embarque`, `validar_cierre_embarque`) → proforma (`convertirAFactura.ts` + RPC `convertir_proformas_a_factura`, split por moneda) → factura/timbrado → REP (`useTimbrarRep.ts`) → NC.
- CXP: buzón/por capturar → aprobación (`aprobar_factura_proveedor`, SOD anti-auto-aprobación) → pagos/anticipos. CXC: `cxc_aging_clientes` por (cliente, moneda). Tesorería: parser BBVA con `hash_dedupe`, `conciliacionMatcher.ts`, traspasos con TC explícito + idempotencia `client_request_id`. Comisiones: periodo CDMX fijo UTC-6.
- Auditoría operativa: 20 reglas en `features/auditoria/domain/core.ts`, tipos en `features/auditoria/types/index.ts`, revisiones/snapshots + digest semanal.

## 8. Errores y observabilidad
- `src/lib/observability/*` (logger, `classifyError`, `reportCaughtError`, `piiScrub`, `fiscalBreadcrumbs`, `sentry/`), tunnel Sentry vía edge function, sampling por ruta en `src/lib/sentry.ts`. Errores de negocio (duplicados, candados `LC_*`) se muestran como avisos y no van a Sentry (`appFeedback`). Ver `docs/observability.md` y `docs/sentry-runbook.md`.

## 9. Pruebas y CI
- Vitest: unit + arquitectura + canaries + ratchets; thresholds en `vitest.config.ts` (lines/statements 38, functions 30, branches 34) con política ratchet — nunca bajarlos.
- E2E Playwright en `e2e/` (proyectos internal/mutators/portal/multi-tenant), corre por cron/dispatch con gate anti-skip.
- SQL: `supabase/tests/*.sql` (~90 guards por "olas"/fixes) vía `scripts/ci/run-guards.sh` + `_guards_manifest.txt`; suites RLS en `.github/workflows/rls-tests.yml`.
- Auditorías `scripts/audit-*.ts` (`audit:all`, reporte en `reports/audit-report.md`) con baselines JSON.
- Cierre obligatorio de cambios de BD: `bun run db:postcheck` (migraciones limpias + baseline regenerada + guards + RLS). Hooks `lefthook`, `knip`, ESLint `--max-warnings 0`.
- Cada cambio: bump `src/constants/appVersion.ts` + entrada en `CHANGELOG.md`.

## 10. Legacy y zonas sensibles
- Legacy explícito: `convertirAMXN/USD`, campos `@deprecated` en `features/bandejas/domain/aggregates.ts` y `features/embarques/types/embarque.ts`, fallbacks históricos en proformas/facturación (`fetchExpedientesConFacturaVivaLegacy`), sombras de dominio aún en `src/{components,hooks,services}/crm` y `src/services/embarques` (SHADOW_ALLOWLIST), `formatFechaEs` congelado por ratchet.
- Sensible (no reimplementar en local): `org_scope()` y políticas RESTRICTIVE, whitelist FIX-45, `soft_delete_record`, `effectiveRole`, canon de conversión/TC/redondeo, RPCs de aprobación CXP y pagos, dedupe bancario, timbrado/cancelación FacturAPI.
- Pendientes conocidos: B-21 (tracking automático naviera) en `roadmap.md`; N14 (anticipos EUR) en `docs/auditoria/backlog-v5-estado.md`; riesgos aceptados en `docs/riesgos-aceptados.md`.
