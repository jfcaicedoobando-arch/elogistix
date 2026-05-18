# Plan — Auditoría v8.201.0 (P2.12 lote 5)

Continuamos la limpieza de complejidad. Estado actual: **30 warnings** (frontend + edge functions). Meta: **≤22 warnings**, sin cambios funcionales ni de BD.

## Alcance

### Frontend (componentes UI)

1. **`CotizacionDatosGeneralesCard` (cx 24)** — extraer `DatosClienteBloque`, `DatosRutaBloque`, `DatosComercialesBloque` a `components/cotizacion/datosGenerales/`.
2. **`SeccionMercanciaCotizacionDetalle` (cx 20)** — extraer `MercanciaItemRow` + helpers de formato a archivo hermano.
3. **`TrackingWarnings` (cx 23)** — extraer `buildWarningList` puro a `lib/tracking/warnings.ts` y dejar el componente como renderer.
4. **`ConceptoRowUSD` (cx 18)** — extraer `formatConceptoUSD` + sub-render `ConceptoRowUSDActions`.
5. **`VirtualDataTable` (cx 18)** — extraer `useVirtualDataTableState` (medición + scroll) y `VirtualDataTableRow`.
6. **`BulkImportDialog` (cx 16)** — extraer `useBulkImportState` (parseo + validación) y subcomponente `BulkImportPreview`.
7. **`AppSidebarBase` (cx 17)** — extraer `useAppSidebarSections` (cálculo de secciones visibles por rol).
8. **`useEmbarquesPageState` (cx 26)** — partir en `useEmbarquesFilters`, `useEmbarquesSelection`, `useEmbarquesBulkActions`.
9. **`useHallazgosTablaState` (cx 17)** — extraer `matchBase` (cx 16) a helper puro con tabla de predicados.
10. **`deriveEventsFromContainer` (cx 22)** en JSONCargo tracking — extraer `mapContainerEvent` y `inferEventType` a `lib/jsoncargo/eventos.ts`.
11. **`classify` (cx 17)** y arrow cx 23 en hooks de cotizaciones/auditoría — extraer predicados.
12. **`buildHeaderHtml` (cx 21)** — extraer `renderHeaderRow`, `renderHeaderMeta`.

### Edge functions (Supabase)

13. **`invite-client-user` (cx 26)** — extraer `validateInput`, `resolveOrgContext`, `createInvite`, `sendEmail` a `_shared/` o helpers locales.
14. **`parse-csf` (cx 20)** — extraer `extractFromPdf` y `mapToProfile`.
15. **`tracking-public` (cx 18)** y **`create-user` (cx 17)** — extraer validación + branching de errores.
16. **`jsoncargo-track` (cx 46, 233 LOC, 254 LOC archivo)** — extraer a `_shared/jsoncargo/`: `fetchContainer.ts`, `normalizeEvents.ts`, `upsertEmbarque.ts`, `handlers.ts`. Handler queda <100 LOC.

### Limpieza

17. Eliminar **`Unused eslint-disable`** directive en archivo señalado.
18. Reducir archivos >250 LOC (3 marcados) extrayendo subcomponentes/helpers.

### Mantenimiento

- Bump `APP_VERSION` → `8.201.0`.
- Entrada en `src/content/changelogData.ts` + `src/content/changelog/v8/chunks/0.ts`.
- Mantener `recentChangelog` en 10 (eliminar 8.190.0).
- Correr suite completa (`vitest run`). Meta: 369/369 verdes.

## Criterios de éxito

- ESLint warnings ≤ 22 (desde 30).
- 0 regresiones; tests verdes.
- Ningún archivo nuevo >200 LOC.
- Sin cambios en BD, RLS, contratos públicos de hooks/services ni firmas de edge functions.

## Fuera de alcance

- Refactor de `services/cotizacion/mutations.ts` (sprint P1.7).
- Nuevos E2E (P3).
- Bajar thresholds de ESLint (lote final).
