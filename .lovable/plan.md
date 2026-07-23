## Estado actual

Sprint 1 ya está cerrado en `v13.309.38` (fix UPDATE `guard_pago_proveedor`, test SQL `cxp_guard_sobrepago.sql` cableado en `rls-tests.yml`, ban `@/features/**` en `src/lib/**` con allowlist ARCH-DEBT). Después vinieron parches de infraestructura (H6, schema-invariants, revalidación de tarifa, columna `es_principal`) hasta `v13.309.44`.

**Lo que sigue según el doc son los 7 ítems del Sprint 2.** Los propongo en 3 PRs para poder revisar/rollback por área. No toca lógica financiera.

---

## Sprint 2 — Plan

### PR-S2-A · Invariantes y ciclos runtime (bajo riesgo, valor alto)

1. **Paridad `roleHierarchy` ↔ `has_role()`** (ítem 1)
   - Nuevo test `src/lib/auth/__tests__/roleHierarchy.invariant.test.ts` espejo de `embarqueFases.invariant.test.ts`: parsea `roleHierarchy.ts` y compara contra los roles/jerarquía que emite `has_role()` en migraciones.

2. **Cubrir `TSAsExpression` en la regla `queryKey`** (ítem 3)
   - Ampliar `scripts/lint/queryKey.ts` (o la regla eslint equivalente) para detectar cast `as unknown as` sobre `queryKey`.
   - Registrar las 2 keys faltantes: `cxp/hooks/useConceptosCfdiFactura.ts:18` y `presupuesto/hooks/usePresupuestoCategorias.ts:13`.

3. **Romper 3 ciclos runtime** (ítem 4)
   - `tesoreria/hooks/useFlujoProyectado.ts:7` — quitar self-import (1 línea).
   - `auditoria/domain/ejecutivoAgregados ↔ ejecutivoRanking` — mover tipos compartidos a `types.ts` hoja.
   - `facturacion/services/facturapi ↔ facturapiConsultar` — misma técnica.
   - Documentar la regla "tipos compartidos en `types.ts` hoja" en `docs/architecture-guidelines.md`.

4. **Bitácora fuera de `lib/`** (ítem 6)
   - Mover `lib/domain/bitacora/registrar.ts` → `src/features/bitacora/services/registrar.ts` (hace I/O).
   - Ampliar roots de `scripts/lib/arch.ts` a `src/lib/**` con allowlist infra (`lib/supabase`, `lib/auth/signOut`, `lib/auth/changePassword`).

### PR-S2-B · Refactor `EmbarqueDetalleHeader` (riesgo medio)

5. **Header con 33 props** (ítem 2)
   - Consumir bundle de `useEmbarqueEstadoActions` dentro del header (patrón `useEmbarqueDetalleTabsData`) para colapsar props.
   - Unificar tipos `EmbarqueProp` y `EmbarqueRow` → quitar `as unknown as` de `EmbarqueDetalleTabs.tsx:34`.

6. **Hooks→components runtime** (ítem 5)
   - Mover `buildEmbarqueColumns` y `findOriginalFacturaIdFor` de hooks a `services/`/`domain/`.
   - Convertir imports type-only a `types/`.

### PR-S2-C · Complejidad (riesgo medio, más contenido)

7. **Refactor de 3 hooks calientes** (ítem 7)
   - `useEmbarqueEstadoActions` (CC ~34) — extraer sub-hooks por acción (aprobar/cerrar/reabrir/cancelar).
   - `useNuevoProveedorController` (~33) — separar carga inicial, submit y sub-form de sucursales.
   - `useOperacionesData` (~32) — dividir por dominio (embarques activos vs alertas).
   - Al terminar: `complexity` warn→error con allowlist ARCH-DEBT vacía o mínima.

---

## Validación

- `bunx vitest run` (invariantes + queryKey + arquitectura + ciclos).
- `bun run lint -- --max-warnings 0`.
- `scripts/ci-fast.sh` completo antes de cerrar cada PR.
- Humo manual: abrir detalle de embarque (header refactor), registrar pago (guard intacto), cambiar estado (hooks refactor).

## Notas técnicas

- Ningún cambio de SQL/migración en Sprint 2 (todo es TS/arquitectura).
- `roleHierarchy` invariant no cambia grants ni policies: solo detecta drift.
- `complexity` sube a error **solo al final** de PR-S2-C para no bloquear PRs previos.
- Bump `APP_VERSION` una vez por PR mergeado y entrada en `CHANGELOG.md`.

## Fuera de alcance (queda para Sprint 3+)

- PR-6 formularios RHF+zod, hidratación wizard, status registry Oleada 2, retrofit LC_ backend, dead code, clones jscpd. Se abordan tras cerrar Sprint 2.

---

¿Arranco por **PR-S2-A** (invariantes + ciclos, sin tocar UI)?
