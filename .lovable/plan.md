## Problema

El CI falla en shard 1/20 y en el job de audit por la regla Power-of-10 de arquitectura:

```
FAIL src/lib/__tests__/architecture-baseline.test.ts
FAIL src/__tests__/audit-report.test.ts
Hay archivos productivos > 200 líneas fuera de allowlist:
  - src/features/admin/services/exportOrg.ts (266 líneas)
```

Al ampliar el export de 18 a 55 tablas (v13.287.0) el servicio quedó en 265 líneas y rompió la baseline arquitectónica. Todos los demás shards, lint, typecheck y build pasan; es el único bloqueo.

## Fix propuesto: dividir `exportOrg.ts` en 3 módulos

Separar el catálogo de tablas y el manifest del orquestador para dejar cada archivo por debajo de 200 líneas, sin cambiar el comportamiento ni el API público.

### Paso 1 — Extraer catálogo de tablas
Crear `src/features/admin/services/exportOrg.tables.ts` con:
- `EXPORT_GROUPS`, `EXPORT_TABLES`, `FORBIDDEN_EXPORT_TABLES`, tipo `ExportTable`.

### Paso 2 — Extraer manifest y tipos
Crear `src/features/admin/services/exportOrg.manifest.ts` con:
- Interfaces `ExportProgress`, `ProgressCallback`, `ExportTableResult`, `ExportManifestInput`.
- Función `buildExportManifest`.
- Constante `SOFT_ERROR_CODES` y helper `isSoftError`.

### Paso 3 — Adelgazar `exportOrg.ts`
Dejar solo:
- Re-exports de tipos/constantes para no romper imports existentes (`EXPORT_TABLES`, `EXPORT_GROUPS`, `FORBIDDEN_EXPORT_TABLES`, `buildExportManifest`, tipos).
- `fetchOrganizationExport` y `exportOrganizationZip`.

Objetivo: archivo final ≤ 150 líneas.

### Paso 4 — Verificar imports
- `TabExportar.tsx` y `exportOrg.test.ts` siguen importando desde `@/features/admin/services/exportOrg` (los re-exports cubren esto).
- No tocar tests.

### Paso 5 — Verificación
- `bun run test src/lib/__tests__/architecture-baseline.test.ts src/__tests__/audit-report.test.ts src/features/admin/services/__tests__/exportOrg.test.ts`
- `bun run lint -- --max-warnings 0`
- `tsgo` typecheck.

### Paso 6 — Versionado
- Bump `APP_VERSION` a `13.287.1`.
- Entrada en `CHANGELOG.md`: fix de arquitectura (split de módulo, sin cambio funcional).

## Notas técnicas

- No se altera el output del ZIP ni el shape del manifest; los tests existentes de `exportOrg.test.ts` (9/9) deben seguir verdes sin modificar.
- El SAFE-CAST del cliente Supabase se queda en `exportOrg.ts` (donde vive el fetch), respetando la regla del proyecto.
- No se toca la allowlist de tamaños; el objetivo es sacar el archivo de la lista de infractores, no añadirlo.
