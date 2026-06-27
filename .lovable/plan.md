## Diagnóstico

El shard 5/20 sale con `exit 1` pero los logs **no muestran qué test falló**. ¿Por qué? El script `test:coverage:shard` corre vitest con `--reporter=blob` (necesario para fusionar cobertura), y ese reporter sólo escribe un archivo JSON — no imprime fallas en stdout. Por eso vemos el `Coverage summary` y luego `exited with code 1`, sin pista alguna del test culpable.

Encima ya tenemos `--retry=2`, así que la falla sobrevivió 3 intentos: no es flake, es un test reproduciblemente roto en CI (probablemente sensible al entorno, no a la máquina local — por eso pasa cuando lo corremos en el sandbox).

**Analogía**: es como si el shard 5 te dijera "reprobé el examen" pero sin mostrarte qué pregunta falló, porque está usando un formato de respuesta que sólo entiende la máquina calificadora.

## Plan

### 1. Hacer visibles las fallas del shard (cambio en `package.json`)
Agregar el reporter `default` junto al `blob` para que stdout muestre el test que falla, sin perder la fusión de cobertura:

```
vitest run --coverage --reporter=blob --reporter=default --retry=2 ...
```

El `blob` sigue escribiendo el JSON para el merge; el `default` imprime el resumen de tests fallidos en el log de CI. Sin esto, no podemos diagnosticar shards que truenen en el futuro.

### 2. Reproducir shard 5 localmente para encontrar el test que falla
Correr en el sandbox exactamente el mismo comando que CI:

```
vitest run --reporter=default --shard=5/20
```

Identificar el (los) archivo(s) fallidos. Hay 28 archivos en ese shard — probable que el culpable sea uno sensible a:
- Variables de entorno faltantes en CI (CI tiene ramps distintos a local)
- Orden de ejecución / state leak entre tests dentro del fork
- Timing (timers reales vs fake) bajo carga del runner de GitHub

### 3. Reparar el test detectado
Aplicar el fix puntual (reset de mocks, `vi.useFakeTimers({ toFake: ["Date"] })`, mock de env, etc.) según el patrón que ya está documentado en `mem://technical/testing-mock-patterns` y `mem://technical/testing-cleanup-protocol`.

### 4. Verificar y bumpear versión
- Correr `vitest run --shard=5/20` localmente para confirmar verde
- Actualizar `CHANGELOG.md` + `APP_VERSION` (bump patch)

## Lo que NO haré
- No volveré a bajar el umbral de cobertura (regla `mem://principles/coverage-threshold`).
- No quitaré `--retry=2` — sólo agregaré visibilidad.
- No tocaré tests ajenos al shard 5.

¿Lo apruebas y procedo?
