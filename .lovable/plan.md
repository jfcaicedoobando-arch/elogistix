# Plan de cobertura de tests — Libre Carga

Auditoría hecha con 2 sub-agentes paralelos. Cobertura actual: **~29% líneas / 47% funciones**. Mayor riesgo: páginas, multi-tenancy y flujos financieros end-to-end.

---

## Fase 1 — CRÍTICO (bloquea regresiones de dinero/seguridad)

### 1.1 Tests RLS para roles no-admin
Hoy **todas** las suites en `supabase/tests/rls/` usan solo `role='admin'`. Una policy mal escrita para `viewer`/`operador`/`vendedor`/`contador`/`cliente` no se detecta.
- Crear `supabase/tests/rls/test_rls_roles_no_admin.sql` con matriz: rol × tabla crítica (`facturas`, `pagos_factura`, `comisiones_devengadas`, `embarques`, `cotizaciones`, `tesoreria_*`) × operación (SELECT/INSERT/UPDATE/DELETE).
- Agregar suite `test_rls_portal_isolation.sql`: usuario `cliente` NO ve datos de otra organización ni columnas internas (costo, margen).
- Agregar tests DELETE cross-org para `pagos_factura`, `facturas`, `comisiones_devengadas`.

### 1.2 Edge functions sin test
Crear `*_test.ts` con Deno test para:
- `auditoria-explicar-hallazgo` (251 líneas, IA + auth org) — prioridad máxima.
- `send-transactional-email`, `enviar-cotizacion-email/handlers.ts`, `handle-email-suppression`, `handle-email-unsubscribe`, `preview-transactional-email`.

### 1.3 E2E de flujos financieros reales
Reemplazar los specs "smoke" (`03`, `04`, `05`) que solo verifican tabs/redirecciones, por flujos completos:
- `08-cotizacion-a-embarque.spec.ts` — crear cotización → aprobar → convertir a embarque.
- `09-emitir-factura.spec.ts` — emitir, verificar CFDI, descargar PDF.
- `10-conciliacion-cobro.spec.ts` — registrar pago, conciliar movimiento bancario, validar saldo.
- `11-portal-acciones.spec.ts` — cliente descarga CFDI, aprueba cotización, sube docs.
- `15-auditoria.spec.ts` — ver hallazgo → explicar con IA → marcar revisado.

### 1.4 Seed reproducible E2E
- Crear `supabase/seed.sql` con datos fijos (UUIDs estables tipo `00000001-...`).
- Crear `e2e/fixtures/data.ts` con factories (`createShipment`, `createInvoice`).
- Eliminar `test.skip(!E2E_HAS_SEED)` en specs `02` y `07` — debe fallar duro si no hay seed.

---

## Fase 2 — ALTO (lógica de negocio sin red de seguridad)

### 2.1 Hooks complejos sin tests
Crear `__tests__/` para:
- `useFacturacionPageController` (134 líneas)
- `usePortalData`, `usePortalEmbarquesController`
- `useTesoreriaCuentasController`, `useTesoreriaMovimientos`
- `useNotasCredito`, `useFacturas`
- `useBitacora`, `useGlobalSearch`, `useOrgFilter`
- Ampliar `usePermissions.test` para cubrir los 10 roles modernos.

### 2.2 Componentes UI financieros sin tests (60 archivos)
Priorizar dialogs que mueven dinero:
- `DialogRegistrarPago`, `DialogNotaCredito`, `DialogMarcarFacturada`, `PanelConciliacionMovimiento`.
- Resto de `features/facturacion|portal|tesoreria|profit/components` en backlog.

### 2.3 Estabilizar mocks de Supabase
- Migrar los 35 tests con `vi.mock(...)` inline al helper centralizado `src/test/utils/_supabaseChainMock.ts` (o `createSupabaseMock` ya existente).
- Documentar el patrón único en `CONTRIBUTING.md`.

### 2.4 Reemplazar barrel smoke tests inútiles
Sustituir los 6 `index.test.ts` que solo hacen `toBeDefined()` por tests reales por función o eliminarlos:
- `auditoria`, `comisiones`, `cxp`, `tesoreria`, `profit`, `presupuesto` services.

### 2.5 Endurecer specs E2E flaky
- `02-embarque.spec.ts`, `04-conciliacion.spec.ts`: reemplazar `Promise.race` por waits explícitos en estado estable.
- `06-security-cross-org.spec.ts`: verificar explícitamente ausencia de datos (no solo redirect).

---

## Fase 3 — MEDIO (pulido y deuda técnica)

- Tests de hooks de layout/sentry/notificaciones (5 archivos).
- `embarqueWizardSchemas.test.ts`: validar mensajes de error reales, no solo `toBeDefined`.
- `pdf/theme/tokens.test.ts`: validar valores concretos de tokens.
- Tests de smoke de páginas (`src/pages/**`) con `routes.smoke` extendido para renderizar (no solo path-check).
- Test de `useReportesPageController`.

---

## Detalles técnicos

**Stack**: Vitest (unit) + Playwright (E2E) + Deno test (edge functions) + pgTAP-like SQL (RLS).

**Convenciones a respetar**:
- `vi.hoisted` + `createSupabaseMock` para mocks (memory: testing-mock-patterns).
- `afterEach` global ya hace cleanup RTL/PDF (memory: testing-cleanup-protocol).
- Archivos ≤200 líneas (Power-of-10).
- Cada test con al menos un `expect` real (regla `missing-assertions` del audit-tests).

**Métrica objetivo post-Fase 1**: 50% líneas / 65% funciones + 0 edge functions críticas sin test + matriz RLS completa para 5 roles.

**Estimación**: Fase 1 ≈ 3-4 sesiones de trabajo, Fase 2 ≈ 4-5 sesiones, Fase 3 ≈ 2 sesiones.

---

¿Quieres que arranque por Fase 1 completa, o prefieres que empiece por un sub-bloque específico (p.ej. solo RLS no-admin, o solo edge functions sin test)?
