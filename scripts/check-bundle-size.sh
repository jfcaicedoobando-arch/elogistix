#!/usr/bin/env bash
# scripts/check-bundle-size.sh — Bundle-size gate para CI.
# Falla el job si el chunk inicial (entry) gzipped supera el budget.
# Uso:  BUNDLE_BUDGET_KB=350 bash scripts/check-bundle-size.sh
set -euo pipefail

BUDGET_KB="${BUNDLE_BUDGET_KB:-350}"
DIST_DIR="${DIST_DIR:-dist/assets}"

if [ ! -d "$DIST_DIR" ]; then
  echo "::error::Directorio $DIST_DIR no existe. ¿Corriste 'vite build' antes?"
  exit 1
fi

# index-*.js es el entry chunk (main bundle). Tomamos el más grande por seguridad.
ENTRY_FILE=$(ls -S "$DIST_DIR"/index-*.js 2>/dev/null | head -1 || true)
if [ -z "$ENTRY_FILE" ]; then
  echo "::error::No se encontró ningún chunk index-*.js en $DIST_DIR"
  exit 1
fi

GZIPPED_BYTES=$(gzip -c "$ENTRY_FILE" | wc -c)
GZIPPED_KB=$(( GZIPPED_BYTES / 1024 ))

echo "→ Entry chunk: $(basename "$ENTRY_FILE")"
echo "→ Gzipped size: ${GZIPPED_KB} KB (budget: ${BUDGET_KB} KB)"

if [ "$GZIPPED_KB" -gt "$BUDGET_KB" ]; then
  echo "::error::Entry chunk ${GZIPPED_KB} KB excede el budget de ${BUDGET_KB} KB."
  echo "Causas comunes: import estático de @react-pdf/renderer, xlsx, recharts en main.tsx o providers."
  echo "Sugerencia: ejecutar 'ANALYZE=true bun run build' y revisar dist/bundle-stats.html"
  exit 1
fi

echo "✓ Bundle size OK"
