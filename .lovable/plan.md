# Fix CI — logs `79259840118` (build v13.297.3)

Tres jobs rojos (quality + tests + coverage), todos por regresiones dejadas por las fases P2/P3 de plantillas/versiones y por el `--max-warnings 0` del lint.

## Diagnóstico

### 1. `Tests` (shard 13/20) — arquitectura
- `hooks y contexts no importan @/integrations/supabase/client directamente` falla por:
  - `src/features/cotizacion/hooks/useCotizacionPlantillas.ts`
  - `src/features/cotizacion/hooks/useCotizacionVersiones.ts`
- `no hay 'as unknown as' sin marcador SAFE-CAST fuera de src/lib y src/test` falla por:
  - `useCotizacionVersiones.ts:40` y `:64` (el comentario SAFE-CAST está separado por código).

### 2. `Lint` — `--max-warnings 0` (10 warnings)
- `react-refresh/only-export-components` en `HallazgoDetalleCell.tsx:38` (export de `getHallazgoDetalleParts` conviviendo con el componente) y `GuardarPlantillaDialog.tsx:41` (export de `limpiarValues` + `CAMPOS_TRANSITORIOS`).
- 7 `Unused eslint-disable directive` en 3 tests (`GuardarPlantillaDialog.test.tsx`, `PlantillaSelectorPaso1.test.tsx`, `useCotizacionDraftAutosave.test.tsx`).
- `max-lines` en `src/features/cotizacion/routes/CotizacionPlantillas.tsx` (321 líneas / máx 250).

### 3. `Coverage merge & report` — cae en cascada porque el shard 13 no emite el blob esperado. Se arregla solo al reparar los tests.

## Cambios

### A. Mover I/O de plantillas a servicio
Nuevo `src/features/cotizacion/services/plantillas.ts` con:
- `fetchPlantillas(orgId)` — SELECT actual con `is('deleted_at', null)` + `order/limit`.
- `insertPlantilla(input)` — INSERT + `.single()`.
- `aplicarPlantillaRpc(id)` — `supabase.rpc('aplicar_plantilla_cotizacion', …)`.
- `softDeletePlantilla(id)` — UPDATE `deleted_at`.
- `updatePlantillaMeta(id, patch)` — UPDATE metadatos.

`useCotizacionPlantillas.ts` pasa a importar sólo del servicio. Cero import de `@/integrations/supabase/client`. Ya no requiere las 4 líneas `eslint-disable @typescript-eslint/no-explicit-any` — los tipos vivirán en el servicio con casts `SAFE-CAST` cuando aplique.

### B. Mover I/O de versiones/duplicado a servicio
Nuevo `src/features/cotizacion/services/versiones.ts` con:
- `duplicarCotizacionRpc(id): Promise<string>` — encapsula el `rpc('duplicar_cotizacion', …)` con los `as never` (ahí sí lleva el marcador `// SAFE-CAST:` en la línea inmediata anterior).
- `fetchVersiones(cotizacionId): Promise<CotizacionVersionRow[]>` — encapsula el `.from('cotizacion_versiones' as never)`.

`useCotizacionVersiones.ts` queda como puros hooks React Query que consumen el servicio. Sin `as unknown as` en su archivo.

### C. Extraer utilidades de componentes (react-refresh)
- `src/features/auditoria/components/HallazgoDetalleCell.tsx` → mover `DOCUMENT_RULES`, `normalizeDocName`, `uniqueDocuments`, `suffixRepeatsDocuments` y `getHallazgoDetalleParts` a `HallazgoDetalleCell.utils.ts` (sibling). El componente sólo re-exporta / consume; ningún consumidor externo debería romperse porque los que importan `getHallazgoDetalleParts` migrarán al nuevo módulo (grep confirmará y ajustaré imports).
- `src/features/cotizacion/components/wizard/GuardarPlantillaDialog.tsx` → mover `CAMPOS_TRANSITORIOS` + `limpiarValues` a `guardarPlantillaHelpers.ts`. El test `GuardarPlantillaDialog.test.tsx` cambia el import de `limpiarValues` a la nueva ruta.

### D. Limpiar eslint-disable innecesarios
Quitar los `// eslint-disable-next-line @typescript-eslint/no-explicit-any` que ESLint marca como "unused directive" en:
- `GuardarPlantillaDialog.test.tsx` líneas 39, 47, 63, 66.
- `PlantillaSelectorPaso1.test.tsx` línea 49.
- `useCotizacionDraftAutosave.test.tsx` líneas 69, 123.

### E. Reducir `CotizacionPlantillas.tsx` (321 → ≤250)
Extraer a componentes sibling:
- `CotizacionPlantillas.PlantillaCard.tsx` — la tarjeta individual con menú acciones.
- `CotizacionPlantillas.EditarDialog.tsx` — dialog de editar metadatos.
El archivo route se limita a estado, hooks, layout y wire de callbacks.

### F. Housekeeping
- Bump `APP_VERSION` → `13.297.4`.
- Entrada en `CHANGELOG.md` describiendo el fix de CI (guardrails de arquitectura, `--max-warnings 0`, react-refresh, max-lines).

## Verificación
- Grep post-cambio: `rg "from ['\"]@/integrations/supabase/client" src/features/cotizacion/hooks` debe quedar vacío.
- Grep: `rg "as unknown as" src/features/cotizacion` sólo dentro de `services/` y con marcador SAFE-CAST.
- Los tests que usan `limpiarValues` seguirán pasando por import de la nueva ruta.

## Notas
- No toco `src/integrations/supabase/client.ts` ni `types.ts`.
- Sin cambios de BD ni de RLS.
- Los `SAFE-CAST` de las RPC nuevas se pueden quitar cuando se regeneren los tipos generados; mientras tanto, viven aislados en el servicio.
