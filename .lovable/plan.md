## Contexto

El CI de este run reportó `tests=failure` y `coverage=failure`. El fallo de coverage es consecuencia directa del fallo de tests (los blobs no se generan bien cuando hay shards fallidos), así que arreglando los tests el coverage se destraba solo.

Tres tests fallan por dos regresiones muy pequeñas que dejaron los cambios recientes (Fase G "tenancy" + Fase J "profit invalidations"). Ninguno es un bug de producción — son mocks de test desactualizados. Analogía: cambiamos la cerradura de una puerta (agregamos `organizationId` obligatorio y una nueva llave `queryKeys.profit`) y las llaves de repuesto que guardábamos en los tests todavía tienen la forma vieja.

## Fallos y arreglos

### 1) `src/features/tesoreria/hooks/__tests__/useTesoreria.test.tsx`
- **Síntoma**: `useFlujoProyectado (composer) > fetches projection data when sources are ready` → `isSuccess` nunca llega a `true`.
- **Causa**: En Fase G se agregó `enabled: ready && !!organizationId` al hook, pero el test no monta `OrganizationContext`, así que `organizationId` es `undefined` y la query queda deshabilitada para siempre.
- **Fix**: agregar `vi.mock("@/hooks/shared", ...)` con `useOrgFilter: () => ({ organizationId: "org-test" })` — mismo patrón que ya se aplicó en `usePresupuestoVsReal.test.ts`.

### 2) `src/features/facturacion/hooks/__tests__/usePagosFactura.test.tsx`
- **Síntoma**: `TypeError: Cannot read properties of undefined (reading 'all')` en `invalidateProfitDependencies.ts:15`.
- **Causa**: El test mockea `@/lib/query` con un `queryKeys` reducido (solo `facturas`, `dashboardEjecutivo`, `presupuesto`). En Fase J, `invalidateProfitDependencies` empezó a leer también `queryKeys.profit.all`, y el mock no lo expone.
- **Fix**: agregar `profit: { all: ["profit"] }` al stub de `queryKeys` en el `vi.mock` de ese test.

### 3) `src/features/presupuesto/hooks/__tests__/usePresupuestoVsReal.test.ts`
- **Ya arreglado en el turno anterior** (mock de `useOrgFilter` + campos `categorias_en_exceso`/`top_exceso` en el fixture). Sólo verificar que el push llegó al CI del próximo run.

## Verificación

1. `bunx vitest run` sobre los 3 archivos afectados.
2. Correr también `useTesoreria` completo y `usePagosFactura` completo (por si arrastran algo más).
3. No hace falta bump de versión ni entrada de CHANGELOG — es fix puramente de tests, no cambia comportamiento del usuario. (Si prefieres registrar el fix en el CHANGELOG bajo un patch `13.300.40`, lo agregamos; pero para test-only mi recomendación es no versionar.)

## Detalles técnicos

```ts
// useTesoreria.test.tsx — agregar antes de los otros vi.mock
vi.mock("@/hooks/shared", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/shared")>("@/hooks/shared");
  return { ...actual, useOrgFilter: () => ({ organizationId: "org-test" }) };
});
```

```ts
// usePagosFactura.test.tsx — dentro del mock de "@/lib/query"
queryKeys: {
  facturas: { all: ["facturas"], pagos: (id: string) => ["facturas", "pagos", id] },
  dashboardEjecutivo: { all: ["dashboard-ejecutivo"] },
  presupuesto: { all: ["presupuesto"] },
  profit: { all: ["profit"] },  // ← nuevo
},
```

## Riesgos

Cero cambios en código de producción. El único riesgo es que existan **otros** tests con el mismo patrón viejo que no aparecieron en este CI (por sharding aleatorio). Voy a hacer un `rg` rápido de `queryKeys.profit\b` en test files y de `enabled.*organizationId` en hooks para verificar que no queden más mocks huérfanos antes de dar por cerrado el fix.
