## Objetivo
Dejar el CI en verde. Revisé los logs del run 30501284428 y reproduje/confirmé cada causa en el código actual.

## 1. Arquitectura — `features/*/domain` importa hooks
`src/features/cotizacion/domain/cotizacion.acciones.ts` importa `@/hooks/shared/permissionMatrix`, lo que rompe la jerarquía Pages→Hooks→Services→Lib.
- Mover `FINANCE / OPERATIONS / SALES / hasRole` (matriz de permisos pura, sin React) a `src/lib/access/permissionMatrix.ts`.
- Reexportar desde `@/hooks/shared/permissionMatrix` para no romper consumidores existentes.
- `cotizacion.acciones.ts` importa desde `@/lib/access/permissionMatrix`.

## 2. Rutas — `appRoutes.smoke.test.tsx`
El test redefine `FINANCE_READ_ROLES` local con un orden distinto al de `src/lib/access/roleRouteMatrix.ts` (única fuente de verdad).
- Borrar las constantes duplicadas del test e importar las reales desde `@/lib/access/roleRouteMatrix`, evitando que vuelva a desincronizarse.

## 3. Sidebar ↔ matriz de roles
Fallan `vendedor` y `super_admin`: el sidebar les muestra ítems que `roleRouteMatrix` no permite (p.ej. `/auditoria` no incluye `super_admin`; ítems de Costeo/Profit para `vendedor`).
- Primero listar exactamente las URLs ofensivas con un script temporal.
- Corregir en la matriz: añadir `super_admin` a todas las rutas donde hoy falta (es rol total) y alinear los accesos de `vendedor` (Costeo/Profit) con lo que el sidebar realmente ofrece; si algún ítem no debe verse, quitarlo del builder en vez de abrir la matriz.

## 4. Toast de query fallida
El código usa la acción "Reintentar" (decisión Q-08: no navegar fuera del wizard); el test aún espera "Ver detalles".
- Actualizar `queryClient.toast.test.ts` a "Reintentar" y verificar que se llama al refetch.

## 5. Guardrail Fase D (`saldo-factura-fase-d.test.ts`)
El test toma "la migración más reciente que redefine `saldo_factura`", y ahora esa es la migración de reparación 13.340 (que sólo redefine la función y recalcula estados), por lo que no contiene `validar_cierre_embarque` ni el trigger de NCs.
- Cambiar el helper para que busque la migración canónica que además contiene `validar_cierre_embarque` (o separar las aserciones: unas contra la última definición de `saldo_factura`, otras contra la última de `validar_cierre_embarque`).

## 6. Knip (código muerto)
- Eliminar `src/features/compras/routes/_sections/ConciliacionDetalleTabla.tsx` (archivo sin uso tras el refactor).
- Quitar el `export` de tipos no usados: `ConceptoVentaPrellenado`, `ConceptoCostoFromCotizacion`, `EstadoCotizacionAccion`, `AccionesCotizacionPermitidas`, `StoredDraft`, `AvanzarEstadoEmbarqueInput`, `ReabrirEmbarqueInput`, y `translatePostgresError` (o marcarlos como usados si aplican en tests).
- Los tipos `Seed*` de `src/lib/e2e/seedDemoData.ts` son "hints" de configuración: se resuelven agregando el patrón `src/lib/e2e/**` a `ignoreExportsUsedInFile`/entry en `knip.json`.

## 7. ESLint
- Confirmar que el fix de `ClienteDetalleTabs.tsx` (allowlist cross-feature) ya en repo pasa, y limpiar los warnings del React Compiler en `useCotizacionDraftAutosave.ts` (refs mutadas durante render).

## Verificación
`bun run lint`, `bun run lint:unused:strict`, `bunx tsgo --noEmit`, `bun run audit:migrations` y los 5 archivos de test afectados; luego una corrida completa de vitest.

## Cierre
Actualizar `CHANGELOG.md` y subir `APP_VERSION` a `13.343.1`.
