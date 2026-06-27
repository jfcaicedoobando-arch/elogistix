## Diagnóstico

Run nuevo (`76374375182`), mismo síntoma que el anterior: el job *Coverage merge & report* falla con:

```
Coverage for lines     21.65% < 38%
Coverage for functions 38.34% < 52%
Coverage for branches  64.29% < 72%
```

Todos los 20 shards pasaron sus tests (un shard ejemplo: 2,248 / 63,117 statements = 3.56%). El fix de `v13.137.46` (quitar `--reporter=default`) **no movió la aguja** — la cobertura real se desplomó por otra razón, no por el reporter. Mi diagnóstico anterior fue incorrecto, lo siento.

**Analogía**: pensé que el termómetro estaba mal calibrado, pero resultó que el paciente sí tiene fiebre.

## Hipótesis de la caída real

Las rondas recientes de "endurecimiento de tests" (shards 9-12, v13.137.41–43) hicieron varias cosas que pudieron reducir cobertura:

1. **Resets globales de `mock.tableCalls` en `beforeEach`** evitan que tests posteriores ejecuten ramas que dependían del estado acumulado.
2. **`vi.useFakeTimers({ toFake: ["Date"] })`** restringido en `cxpKpis.test.ts` (y posiblemente otros) puede dejar sin ejecutar ramas que dependían de timers fake completos.
3. **Mocks más estrictos** que ya no devuelven datos por defecto → menos ejecución de helpers/branches downstream.
4. Posible exclusión accidental de archivos del denominador no es el problema (denom es estable: 126K stmts).

## Plan

### 1. Reproducir la cobertura merge localmente
Correr en el sandbox el flujo completo igual a CI (20 shards + merge) y obtener el `reports/coverage-report.md` para confirmar el 21.65% y ver **qué archivos cayeron** respecto al baseline (último build verde).

```
bun run test:coverage:shard -- --shard=1/20 ... # x20
bun run test:coverage:merge
```

### 2. Identificar la regresión
Comparar `coverage/coverage-summary.json` actual contra el último baseline conocido (~40%). Listar los 20 archivos con mayor pérdida de cobertura. Eso apunta al commit/fix que la causó.

### 3. Restaurar cobertura sin bajar umbral
Según `mem://principles/coverage-threshold`: **prohibido bajar el threshold**. Opciones, en orden de preferencia:

- **3a.** Revertir el reset global de `mock.tableCalls` *sólo* en tests donde el reset eliminó ejecución de ramas (mantenerlo donde realmente prevenía falsos positivos).
- **3b.** Agregar tests adicionales para los archivos top-regresores hasta volver a ≥38% lines / ≥52% functions / ≥72% branches.
- **3c.** Si un fix concreto del endurecimiento fue contraproducente, ajustarlo (no revertir todo).

### 4. Verificar y bumpear
- Re-correr merge localmente, confirmar ≥38% en las 4 métricas (con margen ≥2pp).
- Bump `APP_VERSION` + entrada en `CHANGELOG.md`.

## Lo que NO haré
- No bajaré el umbral (`mem://principles/coverage-threshold`).
- No agregaré `--reporter=default` de regreso.
- No tocaré shards/`--retry=2`.

## Riesgo
Re-correr 20 shards localmente toma ~10-15 min de sandbox. Si prefieres, puedo saltar el paso 1 y ir directo al paso 2 leyendo el último `coverage-report.md` del repo (si existe baseline). Avísame.

¿Apruebas y procedo en modo build?