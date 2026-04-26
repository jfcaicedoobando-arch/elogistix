## Auditoría rápida (v8.89.0) — Top 5 mejoras ejecutables en un solo paso

### Hallazgos clave

1. **17 servicios standalone** en `src/services/*.ts` no siguen la convención folder/barrel (`folder/index.ts`) que sí usan `cotizacion/`, `embarque/`, `cliente/`, `proforma/`, `admin/`, `portal/`.
2. **38 hooks sueltos** en la raíz de `src/hooks/` mezclan dominios (portal, configuración, catálogos, dashboard, admin) sin agrupación.
3. **Diálogos densos**: `NuevoClienteDialog.tsx` (228 LOC) y `NuevoProveedorDialog.tsx` (202 LOC) mezclan estado, parsing CSF, validación y UI.
4. **Carpetas underutilized**: `src/components/shared/` contiene un único archivo (`ProfitBadge.tsx`); `src/test/` solo `setup.ts`.
5. **`useCotizaciones.ts` y `useEmbarques.ts`** ya son barrels correctos — buen patrón a replicar para hooks de catálogos.

---

### Top 5 mejoras (ejecutables en un solo paso, v8.90.0)

1. **Agrupar hooks de catálogos** en `src/hooks/catalogos/`
   - Mover: `useNavieras.ts`, `usePuertos.ts`, `useTiposContenedor.ts`, `useOperadoresDistintos.ts`, `useTasaIVA.ts`, `useExchangeRates.ts`.
   - Crear barrel `src/hooks/catalogos/index.ts` y mantener re-exports en la raíz para no romper imports.

2. **Agrupar hooks de configuración** en `src/hooks/configuracion/`
   - Mover: `useConfiguracion.ts`, `useConfiguracionGlobal.ts`, `useConfiguracionOrg.ts`, `useConfiguracionState.ts`.
   - Barrel `index.ts` + re-exports raíz.

3. **Agrupar hooks de portal** en `src/hooks/portal/`
   - Mover: `usePortalData.ts`, `usePortalDashboardKpis.ts`, `usePortalDocumentDownload.ts`.
   - Barrel `index.ts` + re-exports raíz.

4. **Estandarizar 3 servicios críticos** a folder/barrel
   - Convertir `authService.ts`, `storage.ts` y `csfService.ts` en `services/auth/`, `services/storage/`, `services/csf/` con `index.ts` (re-exports).
   - Mantener archivos antiguos como shim de re-export para evitar romper imports.

5. **Extraer controller de `NuevoClienteDialog`** → `useNuevoClienteController.ts`
   - Mover lógica de estado (`form`, `step`, `documentos`, `modoAlta`, `csfFile`), handlers (`handleNext`, `handleSave`, `handleCsfUpload`, `handleFileChange`) y validaciones a `src/hooks/cliente/useNuevoClienteController.ts`.
   - Dejar el diálogo como componente puramente presentacional (~80 LOC).

---

### Detalles técnicos

- **Sin breaking changes**: todas las migraciones de hooks/servicios mantienen re-exports en la ruta original.
- **Verificación**: `bun run typecheck` + `bunx vitest run` (184 tests deben seguir pasando).
- **Documentación**: actualizar `ARCHITECTURE.md` (subsección de hooks por dominio) y agregar entrada **v8.90.0** a `src/content/changelog/v8.ts` + `Changelog.tsx`.

### Fuera de alcance (para iteraciones futuras)

- Migrar los 14 servicios restantes a folder/barrel.
- Extraer controller de `NuevoProveedorDialog`.
- Aplicar patrón controller a `Embarques.tsx` y `Cotizaciones.tsx` (requiere refactor más profundo).
- Promover `ProfitBadge` a `components/` y eliminar `components/shared/`.
