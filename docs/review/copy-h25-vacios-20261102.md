# H25 · Vacíos financieros y filtros

Base: `63757a0df5a3b83d2ec13904fa2efefda11e51e2`. Rama de trabajo: `codex/copy-h25-vacios`.

Se distinguen las búsquedas/filtros sin coincidencias del conjunto realmente vacío en Antigüedad CxC, Antigüedad CxP, Por facturar y Proformas listas. El componente reutilizable `FilteredListEmptyState` usa `EmptyStateInline`, con el mensaje «No hay resultados con los filtros actuales» y la acción «Limpiar filtros» sólo cuando hay filtros activos.

La limpieza reutiliza `resetAll` del listado: borra búsqueda, filtros de tabla y rango del listado, conservando moneda y fecha para antigüedad, que tienen estado independiente. Los ceros de Aging identifican por cobrar/por pagar y la moneda; los de las bandejas limitan la afirmación a esa bandeja y a crear un borrador. Los límites de carga/error existentes conservan precedencia sobre los vacíos.

No se cambiaron hooks de datos, consultas, cálculos, permisos, reglas de cartera/pagos, SQL ni contratos de backend. Tampoco se modificó la descripción de Por facturar que corrige la rama editorial concurrente. Se leyeron AGENTS raíz, CxP y Proformas y el H25 del informe de auditoría del 2 de noviembre.

## Verificación

- Node `24.19.0`, dependencias existentes mediante el symlink `node_modules` del worktree; sin cambios de dependencias o lockfiles.
- Lint focal de los cinco archivos productivos y la prueba nueva: sin errores ni advertencias.
- `flock /tmp/librecarga-copy-typecheck.lock node node_modules/typescript/bin/tsc -b --pretty false`: correcto.
- Vitest focal: 59 pruebas, 5 archivos. Incluye 44 casos nuevos de estados/filtros, regresiones de exportación Aging, el componente base de vacíos, tabla móvil y el guard de componente canónico.
- Las pruebas usan filtros reales con Nuqs y tablas reales de escritorio/móvil. Cubren limpiar búsqueda y cubeta, recuperar filas, pasar de filtro sin coincidencias a cero real, conservar moneda/fecha y mostrar reintento en errores.
- Los cinco archivos productivos quedan en 28, 197, 192, 120 y 118 líneas, respectivamente; todos dentro del límite de 200.

Comando de pruebas:

```sh
node node_modules/vitest/vitest.mjs run \
  src/features/facturacion/components/bandejas/__tests__/financialEmptyStates.test.tsx \
  src/features/cxc/routes/__tests__/AgingExportScope.test.tsx \
  src/components/empty/__tests__/EmptyStateInline.test.tsx \
  src/components/shared/dataTable/__tests__/ResponsiveDataTable.mobileAria.test.tsx \
  src/__tests__/architecture/empty-state-inline-canonical.test.ts --maxWorkers=2
```

## Evidencia visual local

Fixture aislada en `.cache/copy-h25-ui/`: monta las cuatro pantallas reales y sus tablas/filtros, sustituyendo hooks de datos, exportaciones y detalles por datos ficticios. La build falla si importa el arranque de la aplicación, Supabase o Sentry. No usa credenciales ni backend. Los estilos son los de la aplicación; no se valida el shell completo ni una sesión publicada.

Se verificaron 64 escenarios: cuatro pantallas × filtro/cero/carga/error × 1280×720 y 691×763 × claro/oscuro. Sin errores de página, solicitudes externas o desborde horizontal. Los filtros se limpiaron con Enter; se verificó la conservación de USD, fecha para antigüedad y un parámetro de periodo ajeno al listado. En los errores se comprobó la propagación de Reintentar.

Capturas y resultados: `/workspace/worktrees/copy-h25-vacios/.cache/copy-h25-ui/evidence/` (`results.json`). Se inspeccionaron visualmente muestras de Aging filtrado en claro/oscuro, Proformas listas sin datos y Por facturar en error. Los logs de lint/tipos/pruebas y la fixture son evidencia local, no artefactos de producción.

Sin cambios de datos reales, push, PR, merge, despliegue o comunicaciones externas. No se necesita una regla de negocio nueva para este alcance.
