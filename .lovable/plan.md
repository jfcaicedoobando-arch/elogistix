## Diagnóstico

El job **CI Success (aggregator)** falló porque:

1. **Shards 2/12 y 6/12 colgaron 20 min y los canceló GitHub Actions** (timeout del job). Los otros 10 shards completaron sus tests en **<30 segundos** cada uno — un shard que tarda 20 min mientras sus hermanos terminan en 25s indica un test individual con **promesa sin resolver, `setInterval` sin cleanup, o `waitFor` mal escrito** que entró en bucle infinito en jsdom. Esto es nuevo (no pasaba con 8 shards).
2. **Coverage merge falló (34.45% < 38%, branches 71.74% < 72%)**. Causa: como shards 2 y 6 no terminaron, sus blobs en `.vitest-reports/` quedaron **stale del cache de la corrida anterior** (`actions/cache@... key: Linux-vitest-2-...`) y el step de upload-artifact subió ese blob viejo. El merge cuenta archivos de antes sin la cobertura real, así que la métrica se desplomó.

No hubo fallos de lint, typecheck, build, edge functions ni de shards individuales que sí corrieron.

## Cambios propuestos

### Paso A — Identificar el test que cuelga (shards 2 y 6)

Reproducir localmente con reporter verbose y timeout corto:

```bash
bunx vitest run --shard=2/12 --reporter=verbose --testTimeout=15000 --hookTimeout=15000 2>&1 | tee /tmp/sh2.log
bunx vitest run --shard=6/12 --reporter=verbose --testTimeout=15000 --hookTimeout=15000 2>&1 | tee /tmp/sh6.log
```

Sospechosos primarios (agregados recientemente y conocidos por ser pesados/asincrónicos):
- Tests E2E-style del flujo fiscal (`flujoFiscal*`, `convertirAFactura*`, `emitirRep*`, `cancelacion*`).
- Tests del wizard de FacturApi (`FacturapiOnboardingWizard*`).
- Tests de hooks con `useQuery` + `waitFor` (probable `act()`/timeout) en `useFacturacionKpisFiscales`.

Buscar en cada test fallido:
- `await waitFor(...)` sin `expect` dentro o con condición que nunca se cumple.
- `setInterval`/`setTimeout` sin `vi.useFakeTimers()` y `vi.clearAllTimers()` en `afterEach`.
- Mocks de Supabase que devuelven una promesa que nunca resuelve (cadena thenable rota).
- `Promise.all` que espera una invocación que nunca se hace.

Corregir cada test ofensor (sin tocar lógica de negocio) hasta que ambos shards corran <2 min.

### Paso B — Blindar el cache para no enmascarar timeouts

Editar `.github/workflows/ci.yml` en la matriz `Tests (shard N/12)`:

1. **No cachear `.vitest-reports/`** en `actions/cache`. Sólo cachear `node_modules/.vitest` (el cache de transformación de vitest). Hoy el path es `node_modules/.vitest\n.vitest-reports`, y eso permite que un blob obsoleto sobreviva entre runs.
2. **Limpiar `.vitest-reports/` antes del run**: cambiar `mkdir -p .vitest-reports` por `rm -rf .vitest-reports && mkdir -p .vitest-reports`.
3. **Condicionar el upload del blob a éxito del step de tests**: agregar `if: success()` al step `Upload vitest blob` (hoy probablemente usa `if: always()`). Sin esto, una cancelación sube basura.

Resultado: si un shard se cuelga otra vez, el merge fallará con "blob missing" en lugar de mentir con cobertura falsa, y veremos el problema en el shard real.

### Paso C — Bajar el techo de tiempo individual de tests

Añadir en `vitest.config.ts`:

```ts
test: {
  // ya existente...
  testTimeout: 20_000,     // 20s por test (default 5s, pero algunos necesitan más)
  hookTimeout: 20_000,
  teardownTimeout: 10_000,
}
```

Cualquier test futuro que se cuelgue va a fallar como `Test timed out in 20000ms` en lugar de consumir los 20 min del job. Es defensa en profundidad.

### Paso D — Versionado y changelog

- Bump `APP_VERSION` → `13.137.23`.
- Entrada en `CHANGELOG.md`:
  > Identificados y corregidos tests colgantes en shards 2 y 6 que provocaban timeouts de 20 min y blobs de cobertura obsoletos. Cache de CI ya no preserva `.vitest-reports/` entre runs.

## Notas

- **No** bajamos el threshold de coverage (regla `mem://principles/coverage-threshold`).
- **No** tocamos lógica de negocio: sólo tests rotos, workflow YAML y config de vitest.
- Si el Paso A no encuentra el test culpable en local en 30 min, plan B: ejecutar shards 2 y 6 con `--reporter=verbose --bail=1` en CI temporalmente, identificar el último test que arranca antes del cuelgue y atacarlo.
