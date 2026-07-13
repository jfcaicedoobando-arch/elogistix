## Fallos detectados en el CI (run 79231484551)

**Job "Tests (shard 20/20)"**: 1 test fallando en `conceptosFacturaCrud.test.ts`.
- `eliminarConceptoFactura borra por id y recalcula` → `TypeError: Cannot read properties of undefined (reading 'opArgs')`.
- Causa: en Papelera Fase 3 (v13.290.0) `eliminarConceptoFactura` pasó de `supabase.from("conceptos_factura").delete().eq("id", ...)` a `supabase.rpc("soft_delete_record", { _table, _id })`. El test sigue buscando la cadena `delete().eq()` en `mock.tableCalls`, que ya no existe → `.find(...)` devuelve `undefined`.

**Jobs "Tests (shard 8/20)" y "Tests (shard 1/20)"**: `audit-report.test.ts` y `architecture-baseline.test.ts` fallan con la misma regla Power of 10:
- `src/features/admin/routes/Papelera.tsx` → 216 líneas
- `src/features/facturacion/services/conceptosFacturaCrud.ts` → 206 líneas

Ambos entraron con las fases de Papelera y hay que dividirlos (política del proyecto: nunca ampliar `OVERSIZED_BASELINE` ni bajar umbrales, escribir/dividir código nuevo).

Ningún otro shard falla. Los aggregators reportan `failure` sólo porque estos 3 shards fallaron.

## Plan

### 1. Dividir `Papelera.tsx` (< 200 líneas)
- Crear `src/features/admin/routes/papelera/tablas.ts` con `TablaMeta`, `TABLAS`, `GRUPOS` y el formatter `dtf`. Sin cambios funcionales.
- Crear `src/features/admin/routes/papelera/columns.tsx` con la fábrica `buildColumns({ restore, purge, onPurgeTarget })` que devuelve `ColumnDef<TrashRow>[]`.
- `Papelera.tsx` queda como composición delgada (~110 líneas): importa las constantes y llama a `buildColumns`.

### 2. Dividir `conceptosFacturaCrud.ts` (< 200 líneas)
- Extraer `recalcularTotalesFactura` (y sus helpers `resolverTasa`/lectura de renglones) a `src/features/facturacion/services/recalcularTotalesFactura.ts`.
- `conceptosFacturaCrud.ts` re-exporta `recalcularTotalesFactura` para no romper call-sites y conserva `insertar / actualizar / eliminarConceptoFactura`.
- Ajuste puramente estructural: cero cambios de lógica, cero cambios de firma pública.

### 3. Actualizar el test `eliminarConceptoFactura borra por id y recalcula`
Reescribir el caso para reflejar el contrato actual (RPC soft-delete):
- Espiar `supabase.rpc` y verificar que se llama con `("soft_delete_record", { _table: "conceptos_factura", _id: "c1" })`.
- Verificar que después se dispara el recálculo (llamada a `facturas` con `update`), tal como hacen los otros tests del archivo.
- No se toca lógica del servicio; sólo se alinea la prueba con el comportamiento post-Papelera.

### 4. Verificación
- Ejecutar los 3 shards afectados: `bun run test:coverage:shard -- --shard=1/20`, `--shard=8/20`, `--shard=20/20`.
- Confirmar que `OVERSIZED_BASELINE` sigue vacío (no la ampliamos).
- No hace falta typecheck/build manual: los ejecuta el harness al mergear.

### 5. Changelog / versión
- Bump `APP_VERSION` a `13.292.2`.
- Entrada en `CHANGELOG.md`:
  - fix(ci/tests): actualizado `conceptosFacturaCrud.test.ts` para el nuevo RPC `soft_delete_record` introducido en v13.290.0.
  - refactor(arch): `Papelera.tsx` y `conceptosFacturaCrud.ts` divididos para respetar el límite Power of 10 (≤200 líneas).

## Notas técnicas
- No se crean tablas ni migraciones.
- No se cambia el contrato público de `eliminarConceptoFactura`; el fix es puramente de test + reorganización de archivos.
- Los nombres de export públicos (`recalcularTotalesFactura`, `eliminarConceptoFactura`, etc.) se conservan mediante re-export desde `conceptosFacturaCrud.ts` para no propagar cambios de imports por la app.