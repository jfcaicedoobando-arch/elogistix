## Diagnóstico

El CI `82225517241` falla en dos jobs (los demás están verdes): **typecheck** y **knip strict**. Ambos son consecuencia directa del `knip --fix` masivo de `v13.320.60`.

**Qué pasó (analogía):** knip quitó los "letreros de salida" (`export`) de tipos que nadie usaba fuera del archivo. Pero en varios archivos ese letrero era lo único que consumía un `import type` que venía de otro módulo. Al quitar el letrero, el import quedó huérfano — como una caja entregada en la bodega que ya no tiene destinatario. TypeScript, con `noUnusedLocals`, marca error.

Ejemplo confirmado en `src/features/facturacion/hooks/useFacturas.ts`: siguen los `type FacturaRow, type FacturaListItem` importados, pero el `export type { ... }` desapareció y quedó un `;` suelto en la línea 14.

### Errores exactos (42 en total)

| Código | Cantidad | Naturaleza |
|---|---|---|
| TS6133 | 34 | `import type { X }` huérfano tras quitar el re-export |
| TS6196 | 8 | Tipo declarado localmente que ya nadie usa |

Archivos afectados: `useAdminData.ts`, `useAlertasSistema.ts`, `useAppLogsHealth.ts`, `usePapelera.ts`, `admin/services/members.ts`, `anticiposProveedorService.ts`, `CxpPorCapturarToolbar.tsx`, `useEstadoCuentaEmail.ts`, `useComisionesDevengadas.ts`, `useFacturasCxP.ts`, `useDashboardOperador.ts`, `useEmbarquesPendientesAdmin.ts`, `embarqueDetalleTabsTypes.ts` (7 tipos), `useContenedoresInfoMap.ts`, `useProformas.ts`, `useReconciliacionEmbarque.ts`, `useBandejas.ts`, `useContactosClienteParaEnvio.ts`, `useFacturas.ts`, `useHuecoFacturacion.ts`, `useNotasCredito.ts`, `useTabProformasController.ts`, `facturacion/services/facturapi.ts`, `usePortalBreadcrumbs.ts`, `useProveedores.ts`.

### Knip strict

Reporta 1 archivo no usado: `src/features/catalogos/domain/tiposContenedorDefault.ts` — es el residuo de cuando se movió `TIPOS_CONTENEDOR_DEFAULT` a `src/lib/domain/` para resolver el error de cross-feature import.

## Plan

**Paso 1 — Limpiar imports huérfanos (34 errores TS6133)**
En cada archivo, eliminar únicamente el especificador `type X` de la lista de import, y borrar el `;` suelto que quedó donde estaba el re-export. Si el import queda vacío, se elimina la sentencia completa.

**Paso 2 — Eliminar tipos locales muertos (8 errores TS6196)**
Principalmente en `embarqueDetalleTabsTypes.ts` (`ResumenProps`, `CostosProps`, `FacturacionProps`, `NotasProps`, `TrackingProps`, `DocHandlers`, `Financials`) y `DireccionOrden` en `CxpPorCapturarToolbar.tsx`. Antes de borrar cada uno se verifica que no esté referenciado dentro del mismo archivo (por ejemplo, `Financials` podría estar embebido en otro tipo); si lo está, se conserva y se ajusta la referencia.

**Paso 3 — Borrar archivo muerto**
`rm src/features/catalogos/domain/tiposContenedorDefault.ts`. Se confirma antes con `rg` que nadie lo importe.

**Paso 4 — Verificación**
- `bun run typecheck` (o `tsgo --noEmit`) → 0 errores
- `bun run lint:unused:strict` → 0 hallazgos
- `bun run lint -- --max-warnings 0` → verde (no debe romperse; los cambios son remociones)
- Smoke de tests de los módulos tocados (facturación, embarques, admin)

**Paso 5 — Versionado**
Bump de `APP_VERSION` a `13.320.61` y entrada en `CHANGELOG.md`.

## Notas técnicas

- No se toca lógica de negocio: todas las ediciones son remoción de declaraciones de tipo e imports sin runtime.
- No se relajan las reglas de `knip.json` ni de `tsconfig` — se cierra la deuda real.
- Riesgo bajo: si algún tipo resulta estar en uso, el typecheck lo detecta de inmediato en el Paso 4.
