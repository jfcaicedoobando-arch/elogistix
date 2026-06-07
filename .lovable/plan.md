# Aislar el shard 2/2 que se cuelga dividiendo en más shards

## Contexto
- CI actual usa `matrix.shard: [1, 2]` con `--shard=N/2`.
- Shard 1/2 termina verde; shard 2/2 se queda hanging (probablemente un test específico, no OOM, porque ya bajamos a singleFork @ 8 GB).
- Vitest acepta cualquier número entero de shards `N/M` (no hay límite duro; GitHub Actions cobra por minutos, no por shards). Lo práctico es 4-8.

## Estrategia
Subir la matriz de 2 → 4 shards. Esto:
1. Reparte los archivos en 4 grupos más pequeños — el shard que contiene el archivo problemático será visible (timeout/hang aislado a 1/4 de la suite en vez de 1/2).
2. Permite identificar el archivo culpable mirando qué shard (1/4, 2/4, 3/4 o 4/4) se cuelga.
3. Reduce el tiempo de cada job (~50% del actual shard 2/2).

### Cambios

**`.github/workflows/ci.yml`** — job `tests`:
- `matrix.shard: [1, 2, 3, 4]`
- `matrix.total: [4]`
- (lo demás del job queda igual; el merge job ya descarga todos los blobs con `pattern: vitest-blob-*`)

**`package.json`** — script `test` local:
- Cambiar la cadena `--shard=1/2 && ... --shard=2/2` a 4 shards secuenciales, para que el dev local pueda reproducir la misma partición.

### Diagnóstico adicional sugerido (sin tocar config)
Para identificar el archivo exacto que cuelga, agregar al job de tests el flag `--reporter=verbose` solo cuando el shard fall — Vitest imprimirá el nombre del último archivo en ejecución antes del timeout del runner. Esto es opcional, pero útil. Si lo quieres lo añado.

## Próximos pasos sugeridos (no parte de este plan, para confirmar después)
- Si shard 4/4 sigue colgando, el siguiente paso es subir a 6-8 shards o agregar `--reporter=verbose` para ver el nombre del archivo justo antes del hang.
- Una vez identificado el archivo, lo podemos excluir temporalmente o investigar el leak/promesa sin resolver.

## Archivos modificados
- `.github/workflows/ci.yml`
- `package.json`
- `CHANGELOG.md` + `src/constants/appVersion.ts` (bump)