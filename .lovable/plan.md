# Plan: bisección de la suite Vitest en 10 shards (modo background)

## Contexto

El script `scripts/bisect-tests.sh` ya existe. Ejecutarlo en foreground excede el timeout de 600s (10 shards × hasta 5 min c/u = posibles ~50 min). Necesitamos lanzarlo en background y verificar progreso por polling.

## Pasos

### 1. Lanzar bisección en background

```
nohup bash scripts/bisect-tests.sh > /tmp/vitest-bisect.out 2>&1 &
echo $! > /tmp/vitest-bisect.pid
```

### 2. Polling (cada llamada ~30-60s)

Repetir hasta que el proceso termine:

```
ps -p $(cat /tmp/vitest-bisect.pid) > /dev/null && echo RUNNING || echo DONE
ls -la /tmp/vitest-shard-*.exit 2>/dev/null
tail -5 /tmp/vitest-bisect-summary.txt
```

### 3. Analizar resultados al terminar

Para cada shard con `exit ≠ 0` o `oom_markers > 0`:

- Extraer secuencia de `heap used: N MB` por archivo (`grep -E "heap used|RUN " /tmp/vitest-shard-<i>.log`).
- Identificar el archivo donde el heap salta sin retornar.

### 4. Pasada fina (si el shard culpable tiene varios sospechosos)

```
npx vitest run <archivo> --logHeapUsage --reporter=verbose
```

### 5. Reporte y versionado

- Escribir `/mnt/documents/test-leak-report.md` con tabla shard × exit × peak_heap × OOM y archivo(s) culpable(s).
- Bump `APP_VERSION` → `12.60.11`.
- Entrada en `CHANGELOG.md` describiendo el script de bisección y el hallazgo.

## Notas

- No se modifica `vitest.config.ts`; sharding es solo diagnóstico.
- Si después de 60 min sigue corriendo, matar el proceso y reportar el último shard activo como el culpable (probable hang por OOM).

YOU NEED TO RUN 1/10 of the tests at a time and report back after each 1/10 is done.