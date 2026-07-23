# Ejecución completa de `docs/arquitectura-auditoria-3-status.md`

Alcance total: cerrar los 8 pendientes documentados + actualizar el reporte cuando terminemos. Se entrega en 6 PRs incrementales para poder ejecutar `lint + tsgo + test:fast + audit:migrations + audit:arch` verde entre uno y otro. Cada PR bumpea `APP_VERSION` y registra entrada en `CHANGELOG.md`.

## Contexto medido en `main` (hoy)

- Formatters pendientes: **41 archivos** con `toLocaleString` / `Intl.NumberFormat` / `toLocaleDateString` fuera de `src/lib/formatters/`.
- Comparaciones `estado === "..."` inline: **68** archivos.
- `useState` en `useNuevaFacturaProveedorForm.ts` = 11; `useEditarFacturaProveedorForm.ts` = 6.
- `EmbarqueDetalleTabsProps` = 12 props (ya agrupadas en `financials` / `docHandlers`).
- Allowlist cross-feature = 7 entradas (después de la baja de 2.3b previa).
- `embarqueFases.invariant.test.ts` ya existe → **item 2.4 residual está cubierto**, sólo hay que actualizar el doc.

## PR-1 · v13.309.23 · Ítem 3.5 · EmbarqueDetalleTabs data-fetching en tabs (S)

Crear `useEmbarqueDetalleTabsData(embarqueId)` en `features/embarques/hooks/` que devuelva `{ documentos, conceptosCosto, facturas, notas, financials }`. Mover los fetch actuales desde `EmbarqueDetalle.tsx` al hook. `EmbarqueDetalleTabs` pasa de **12 → 5 props** (`embarque`, `embarqueId`, `activeTab`, `setActiveTab`, `canEdit`); las tabs internas consumen el hook directamente. Sin cambios de UX.

**Verificación:** `bunx vitest run src/features/embarques` verde + smoke Playwright del detalle de un embarque.

## PR-2 · v13.309.24 · Anexo A residual + Ítem 2.4 doc (S)

- Aplicar el mismo hardening de `beforeEach { clearAllMocks + re-fijar defaults }` a los 2 tests flaky restantes:
  - `usePagosFactura.test.tsx`
  - `useAuthProfile.test.ts`
- Actualizar `docs/arquitectura-auditoria-3-status.md`: marcar 2.4 ✅ (test existe) y anexo A ✅.

**Verificación:** correr los 3 tests 5x en loop (`--repeat`) para descartar flake.

## PR-3 · v13.309.25 · Ítem 2.3(a) · Bajar allowlist a 3 (S)

Promover a `src/lib/domain/` o `src/components/shared/`:
- `versionadoCotizacion` (7 consumidores cross-feature) → `lib/domain/`
- `labelExpediente` → `lib/domain/`
- `ToneBadge` → `components/shared/`
- `BuscarTarifaDialog` (evaluar si es cross-feature o queda como consumo interno)

Actualizar imports, remover entradas de `CROSS_FEATURE_ALLOWLIST` en `eslint.config.js`. Objetivo: **7 → 3** entradas.

**Verificación:** `bun run lint` verde + tests de los módulos promovidos.

## PR-4 · v13.309.26 · Ítem 3.7 · Tests SQL de códigos `LC_*` faltantes (M)

Crear `supabase/tests/lc-codes/` con specs `.test.ts` que ejecutan SQL directo contra la BD dev vía `psql` y validan `SQLSTATE P0001` + mensaje con prefijo `LC_`:

- `lc_cxp_descuadre.test.ts` → forzar descuadre en `_cxp_validar_aprobacion`.
- `lc_tc_no_disponible.test.ts` → registrar pago USD sin TC en `registrar_pago_factura`.
- `lc_emb_cierre_documentos.test.ts` → cerrar embarque con documentos faltantes en `validar_cierre_embarque`.
- `lc_emb_cierre_saldos.test.ts` → cerrar embarque con saldos abiertos.

Wire en `ci-fast.sh` bajo un shard nuevo `test:sql-codes` que sólo corre si `PGHOST` está presente.

**Verificación:** los 4 tests verdes localmente.

## PR-5 · v13.309.27 · Ítem 3.4 · Migración parcial a formatters + StatusBadge (M)

**Táctica:** no migrar los 41 archivos de golpe. Elegir 3 features de mayor concentración (probable: `facturacion`, `cxp`, `embarques`) y migrar sus archivos a:

- `formatMxn`, `formatUsd`, `formatDate`, `formatDateTime` desde `src/lib/formatters/`.
- `<StatusBadge estado={...} />` para reemplazar cascadas `estado === "..." ? ... : ...`.

Objetivo del PR: bajar de **41 → ≤20** archivos con formateo inline y **68 → ≤30** comparaciones `estado === "..."` inline. Documentar plan de continuación para features restantes en `docs/formatters-migration.md`. **No** activar `no-restricted-syntax` todavía (queda para un PR-final cuando lleguemos a 0).

**Verificación:** `bun run test:fast` verde en features migradas + snapshot visual manual de 3 pantallas afectadas.

## PR-6 · v13.309.28 · Ítem 3.3 · RHF+zod para CxP (L)

Reemplazar los 11 `useState` de `useNuevaFacturaProveedorForm.ts` y los 6 de `useEditarFacturaProveedorForm.ts` por un `useForm<FacturaFormValues>({ resolver: zodResolver(facturaFormSchema) })` unificado. Schema en `src/features/cxp/schemas/facturaForm.ts`. Mantener API pública del hook estable (mismos handlers exportados) para no tocar componentes consumidores.

**Verificación:** suite completa de CxP + smoke E2E de crear/editar factura de proveedor.

## Cierre · v13.309.29 · Actualizar reporte y cerrar auditoría 3

Reescribir `docs/arquitectura-auditoria-3-status.md`:
- Bloques 1, 2, 3 con estado post-PRs (esperado: 100% cerrado excepto 3.4 que queda "en progreso" con doc del plan).
- Sección "Trabajo pendiente" vacía o solo con boy-scout de Bloque 4.
- Números duros nuevos: madge, formatters residuales, allowlist.

## Detalles técnicos

- No tocamos `src/integrations/supabase/client.ts` ni `types.ts` (auto-gen).
- `SECURITY DEFINER` nuevos que aparezcan en PR-4 respetan la regla H6 recién instalada (REVOKE + GRANT EXECUTE nominal).
- PR-4 requiere `PGHOST` en CI; si no está presente el shard queda skipped (no falla el pipeline).
- Cada PR es independiente y revertible; el orden minimiza conflictos.

## Riesgo

- **PR-1** (data-fetching en tabs) tiene el mayor riesgo de UX porque cambia dónde se hacen los queries. Mitigación: mantener la key exacta de React Query para no invalidar cachés.
- **PR-6** (RHF migration) es el más grande. Si el hook expone estado interno que consumidores leen, hay que auditar cada uso antes de migrar.
- **PR-5** puede romper snapshots visuales si algún formateo actual difiere en separadores o zonas horarias — revisar con Playwright antes de mergear.

## Alternativa más corta

Si prefieres no cerrar todo, puedo entregar **sólo PR-1 + PR-2 + PR-3** (todas S, sin migración masiva) en un solo turno y dejar 3.4/3.3/3.7 para después. Indícalo cuando apruebes el plan.
