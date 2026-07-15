# Fix CI: lint (queryKey inline) + test hygiene (describe duplicado)

## Contexto

El aggregator falló con `quality=failure` y `tests=failure`. Dos causas independientes, ambas triviales.

## Diagnóstico

**1. Lint (`23_Lint...` job)** — 2 errores `no-restricted-syntax` en `src/features/presupuesto/hooks/usePresupuestoMensual.ts:13`:

```ts
queryKey: [...queryKeys.presupuesto.mensual(anio), organizationId ?? "none"]
```

La regla prohíbe componer `queryKey` inline; toda variante debe vivir en `src/features/<dominio>/queryKeys.ts`.

**2. Test hygiene (`shard 8` — `src/__tests__/audit-report.test.ts`)** — regla `duplicate-title`:

```
describe("computeForecast", ...)  ←→  src/features/dashboardEjecutivo/domain/__tests__/forecast.test.ts:14
src/features/crm/domain/__tests__/forecast.test.ts:51
```

El `describe("computeForecast")` creado en la fase anterior colisiona con uno ya existente en el módulo CRM.

## Cambios

### 1. `src/features/presupuesto/queryKeys.ts`
Agregar builder que incluye organización:

```ts
mensualPorOrg: (anio: number, organizationId: string | null) =>
  ["presupuesto", "mensual", anio, organizationId ?? "none"] as const,
```

### 2. `src/features/presupuesto/hooks/usePresupuestoMensual.ts`
Reemplazar la línea del `queryKey` inline:

```ts
queryKey: queryKeys.presupuesto.mensualPorOrg(anio, organizationId),
```

### 3. `src/features/dashboardEjecutivo/domain/__tests__/forecast.test.ts`
Renombrar el `describe` para eliminar la colisión:

```ts
describe("computeForecast (dashboardEjecutivo)", () => { ... })
```

### 4. Versionado
- `APP_VERSION` → `13.300.35`
- `CHANGELOG.md`: entrada breve "Fix CI: `queryKey` inline en presupuesto mensual + describe duplicado en forecast (dashboardEjecutivo)."

## Verificación

```bash
bun run lint -- --max-warnings 0
bunx vitest run src/__tests__/audit-report.test.ts src/features/dashboardEjecutivo/domain/__tests__/forecast.test.ts src/features/presupuesto/hooks/__tests__
```

Ambos deben pasar.
