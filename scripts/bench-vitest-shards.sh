#!/usr/bin/env bash
# scripts/bench-vitest-shards.sh — diagnóstico reproducible de shards/workers.
#
# P1 · auditoría stack Vite 6 / Vitest 4. Regla del proyecto: NO se cambian
# shards ni `maxWorkers` de CI "a ojo". Este script mide, para 1, 2 y 3 shards:
#   - duración de pared por shard y total;
#   - pico de procesos `vitest` concurrentes;
#   - pico de RSS agregado (memoria realmente usada).
#
# Importante: la suite tiene DOS proyectos Vitest (node + jsdom) y en Vitest 4
# el pool se resuelve POR proyecto, así que el pico de procesos puede llegar a
# ~2 × maxWorkers. Esa es la razón por la que CI usa maxWorkers=2 con heap de
# 8 GB en runners de 4 vCPU / 16 GB.
#
# Uso:
#   bash scripts/bench-vitest-shards.sh            # 1, 2 y 3 shards
#   SHARDS="2 3" bash scripts/bench-vitest-shards.sh
#   VITEST_FORKS=2 bash scripts/bench-vitest-shards.sh   # simula CI
#
# Resultado: tabla en stdout + CSV en /tmp/vitest-shard-bench.csv.
# NO forma parte de CI: es una herramienta de medición manual.
set -uo pipefail

SHARDS_LIST="${SHARDS:-1 2 3}"
OUT_CSV="${OUT_CSV:-/tmp/vitest-shard-bench.csv}"
echo "total_shards,shard,segundos,exit_code,max_procesos,max_rss_mb" > "$OUT_CSV"

muestrear() {
  # Muestrea procesos vitest y su RSS cada segundo mientras exista $1 (PID).
  local pid="$1" max_proc=0 max_rss=0
  # shellcheck disable=SC2009 # se requiere el RSS de `ps`, no sólo los PIDs de pgrep
  while kill -0 "$pid" 2>/dev/null; do
    local snap procs rss
    snap=$(ps -eo rss=,args= | grep -F "vitest" | grep -v grep || true)
    procs=$(printf '%s\n' "$snap" | grep -c . || true)
    rss=$(printf '%s\n' "$snap" | awk '{s+=$1} END {print int(s/1024)}')
    [ -z "$rss" ] && rss=0
    [ "$procs" -gt "$max_proc" ] && max_proc="$procs"
    [ "$rss" -gt "$max_rss" ] && max_rss="$rss"
    sleep 1
  done
  echo "$max_proc $max_rss"
}

for total in $SHARDS_LIST; do
  for shard in $(seq 1 "$total"); do
    echo "▶ shard ${shard}/${total} (VITEST_FORKS=${VITEST_FORKS:-auto})"
    inicio=$(date +%s)
    if [ "$total" -eq 1 ]; then
      bun run test > "/tmp/vitest-bench-${total}-${shard}.log" 2>&1 &
    else
      bun run test:shard -- --shard="${shard}/${total}" \
        > "/tmp/vitest-bench-${total}-${shard}.log" 2>&1 &
    fi
    pid=$!
    read -r max_proc max_rss <<< "$(muestrear "$pid")"
    wait "$pid"; code=$?
    fin=$(date +%s)
    dur=$((fin - inicio))
    echo "  → ${dur}s · exit=${code} · max_procesos=${max_proc} · max_rss=${max_rss} MB"
    echo "${total},${shard},${dur},${code},${max_proc},${max_rss}" >> "$OUT_CSV"
  done
done

echo
echo "CSV: $OUT_CSV"
column -s, -t < "$OUT_CSV"
echo
echo "Criterio de decisión: subir shards sólo si el total de pared baja de forma"
echo "consistente Y el pico de RSS por runner se mantiene bajo ~12 GB (runner de 16 GB)."
