# Subdividir shard 3/4 — subir matriz a 8 shards

## Por qué disectar y no borrar

- **Borrar todos los tests del shard 3/4** = perder ~25% de la cobertura sin saber qué archivo es el culpable. El leak/hang seguirá ahí cuando alguien re-agregue tests, y perdemos los tests sanos que comparten shard.
- **Disectar más** es no-destructivo, barato (CI Actions es por minutos, no por shards) y deja al culpable aislado en ~12% de la suite. Si aún no aparece, subimos a 16.

## Cambio propuesto

`**.github/workflows/ci.yml**` — job `tests`:

- `matrix.shard: [1,2,3,4,5,6,7,8]`
- `matrix.total: [8]`

`**package.json**` — script `test` local actualizado a 8 shards secuenciales (para reproducir localmente la misma partición que CI).

El resto del workflow no cambia: `--reporter=verbose` ya está, el job `coverage` ya descarga todos los blobs con `pattern: vitest-blob-*`.

## Qué esperar después de mergear

1. Vitest reparte los archivos por hash sobre el path — los archivos que estaban en shard 3/4 se redistribuyen entre los nuevos shards 5/8 y 6/8 (aproximadamente, depende del hash).
2. **Uno** de los 8 shards va a colgar. Ese shard contendrá ~12% de la suite (en lugar de 25%).
3. El log con `--reporter=verbose` mostrará la última línea `RUN ...` antes del hang → ese es el archivo culpable, o el siguiente en orden alfabético dentro del shard.

## Siguiente paso si 8 shards no basta

Subir a 16 shards. En 16, cada shard tiene ~6% de la suite (típicamente 5–10 archivos), suficiente para identificar el culpable por inspección manual aunque verbose no muestre el nombre exacto.

&nbsp;

SUBE A 16 shards en este run

## Archivos modificados

- `.github/workflows/ci.yml`
- `package.json`
- `CHANGELOG.md` + `src/constants/appVersion.ts` (bump)