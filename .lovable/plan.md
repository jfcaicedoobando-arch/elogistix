## Contexto

El CI aggregator falló en 3 jobs de tests (shards 6, 7 y 9). Son 3 caídas independientes, todas causadas por cambios de este mismo sprint de performance (Olas 1-2). Ninguna es un bug funcional en la app; son gaps de propagación entre el cambio y sus tests/registros.

### Falla 1 · shard 9 · `agregador.test.ts` (4 tests, todos fallando)

```
Unknown Error: permission denied for function current_user_org_id
```

**Diagnóstico** (verificado leyendo `src/features/dashboardEjecutivo/services/agregador.ts` y el test): en P8 añadí `supabase.rpc("eerr_resumen_anual", …)` dentro de la nueva helper `fetchTendencia12m`. El test mockea todos los servicios upstream (`fetchEstadoResultadosDevengado`, `fetchSaldosCuentas`, …) pero **no mockea `supabase.rpc` directo**, así que la llamada sale a la BD real y truena por RLS (`current_user_org_id`). Además el test espera `fetchEstadoResultadosDevengado.toHaveBeenCalledTimes(14)` — con P8 sólo se llama 2 veces (actual + anterior); la tendencia 12m ya no pasa por ese servicio.

### Falla 2 · shard 7 · `architecture.test.ts` (regla `as unknown as` sin SAFE-CAST)

```
src/features/anticipos-proveedor/services/anticiposProveedorService.ts:55
  const rows = (await unwrapOr(query, [])) as unknown as AnticipoRow[];
```

Este cast entró en QW6 (v13.316.0) sin el marcador `// SAFE-CAST:` requerido por `mem://principles/safe-cast`. La misma línea también rompe `safe-casts-services.test.ts` (shard 6, 2 tests HIGH/CRITICAL).

### Falla 3 · shard 6 · `lcCodeCoverage.test.ts`

```
Faltan mensajes amigables para códigos LC_*:
LC_EERR_FUENTE_INVALIDA
```

En P8 añadí la migración `eerr_resumen_anual` con `RAISE EXCEPTION 'LC_EERR_FUENTE_INVALIDA'` pero no registré el mensaje amigable en `src/lib/errors/lcCodeMessages.ts`.

Todo lo demás (Build, ESLint, TypeScript, Edge Functions, `audit:migrations`, Coverage merge, shards 1-5/8/10) pasó en verde.

## Plan

### 1. Mockear `supabase.rpc` en `agregador.test.ts` + ajustar expectativa

Añadir mock en la cabecera del test:

```ts
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ data: [], error: null }) },
}));
```

Cambiar la aserción del test "invoca EERR para periodo, periodo anterior y 12 meses hacia atrás":

- Antes: `toHaveBeenCalledTimes(14)` sobre `fetchEstadoResultadosDevengado`.
- Después: `toHaveBeenCalledTimes(2)` sobre `fetchEstadoResultadosDevengado` (actual + previo) **y** `expect(supabase.rpc).toHaveBeenCalledWith("eerr_resumen_anual", { p_year: <year>, p_fuente: "facturas" })` para los años involucrados en la tendencia.

Los otros 3 tests del mismo archivo también fallan por el mismo `permission denied` — con el mock de `supabase.rpc` a nivel de módulo, los 4 pasan sin más cambios.

### 2. Marcar el cast HIGH con `// SAFE-CAST:` en `anticiposProveedorService.ts`

Añadir el comentario justificando la degradación (row shape de Supabase con relación embebida), sin cambiar la lógica:

```ts
// SAFE-CAST: unwrapOr devuelve el shape crudo de Supabase con la relación
// embebida `proveedores(nombre)`; el tipo generado no incluye esa join,
// así que degradamos el cast — el mapper de la siguiente línea consume
// exactamente esa forma.
const rows = (await unwrapOr(query, [])) as unknown as AnticipoRow[];
```

Esto cierra los 3 tests de arquitectura (`architecture.test.ts` + `safe-casts-services.test.ts` × 2).

### 3. Registrar `LC_EERR_FUENTE_INVALIDA` en `lcCodeMessages.ts`

Añadir entrada junto al resto de códigos:

```ts
LC_EERR_FUENTE_INVALIDA: {
  title: "Fuente EERR inválida",
  description: "La fuente del Estado de Resultados debe ser 'facturas' o 'embarques'.",
},
```

Cierra `lcCodeCoverage.test.ts`.

### 4. Versión + CHANGELOG

- Bump `APP_VERSION` → `13.317.7`.
- Entrada en `CHANGELOG.md`:
  - Fix tests P8: mock `supabase.rpc` + ajuste tendencia 12m.
  - `SAFE-CAST` marker en `anticiposProveedorService.ts`.
  - Mensaje amigable `LC_EERR_FUENTE_INVALIDA`.

## Verificación

- `bun run test src/features/dashboardEjecutivo/services/__tests__/agregador.test.ts` → 4/4 verde.
- `bun run test src/__tests__/architecture/safe-casts-services.test.ts src/lib/__tests__/architecture.test.ts src/lib/errors/__tests__/lcCodeCoverage.test.ts` → verde.
- No se toca lógica productiva; sólo tests, un comentario `SAFE-CAST` y una entrada en el catálogo de mensajes LC_*.

## Analogía

Piénsalo como tres puertas que quedaron abiertas después del último sprint:

1. **El test del dashboard** llamaba a una función que ahora usa una "vía directa" a la base de datos que el test no había preparado — hay que decirle al test que finja también esa vía.
2. **Un cast tipo `as unknown as`** entró sin la etiqueta "SAFE-CAST" que exige el linter arquitectónico — la etiqueta ya justifica el porqué, no hay que cambiar el código.
3. **Un código de error nuevo** (`LC_EERR_FUENTE_INVALIDA`) no tiene aún mensaje en español para el usuario — lo agregamos al catálogo.

## Fuera de alcance

- No toco lógica de agregador ni de la migración `eerr_resumen_anual`.
- No refactorizo el shape crudo de `anticipos_proveedor` (implicaría reescribir el select de Supabase; fuera del scope de este fix).
