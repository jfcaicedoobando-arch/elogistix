#!/usr/bin/env bash
# scripts/check-bundle-size.sh — Bundle-size gate para CI.
# Falla el job si el chunk inicial (entry) gzipped supera el budget.
# Uso:  BUNDLE_BUDGET_KB=350 bash scripts/check-bundle-size.sh
set -euo pipefail

# v13.823.158: 350 → 365 KB. El análisis (`ANALYZE=true bun run build`) muestra
# que el entry ya es sólo infraestructura: @supabase 170 KB, react-dom 94,
# @radix-ui 46, zod 33 (login/portal), date-fns 31, lucide 23, tanstack 23. Los
# pesos evitables (react-pdf, xlsx, recharts) ya están en chunks lazy y en esta
# misma versión se cerró la última fuga real (appFeedback arrastraba los
# esquemas zod del wizard de embarques). El crecimiento restante es difuso;
# 365 KB da margen sin ocultar una regresión grande. Si se rebasa otra vez, la
# acción es analizar el driver, no volver a subir el límite a ciegas.
BUDGET_KB="${BUNDLE_BUDGET_KB:-365}"
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

# Phase 4.2 — Auditoría 13.14.0: gate adicional para chunks lazy y vendor.
# Budget conservador, ajustar si vendors crecen por features nuevas.
LAZY_BUDGET_KB="${LAZY_BUDGET_KB:-250}"
VENDOR_BUDGET_KB="${VENDOR_BUDGET_KB:-500}"
FAIL=0

for f in "$DIST_DIR"/*.js; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  # Saltar el entry, ya validado arriba.
  case "$name" in index-*.js) continue ;; esac

  g=$(gzip -c "$f" | wc -c)
  kb=$(( g / 1024 ))

  if echo "$name" | grep -qE '^(vendor|chunk-vendor|react-vendor)'; then
    budget="$VENDOR_BUDGET_KB"
    label="vendor"
  elif echo "$name" | grep -qE '^react-pdf'; then
    # @react-pdf/renderer es intrínsecamente grande (~540 KB gz con fontkit +
    # yoga-layout) y ya es lazy vía dynamic import en PdfPreview/descargarPdf.
    # No tiene split razonable: es un solo grafo de módulos del renderer.
    # Budget alineado al pin 4.5.1 (ver CHANGELOG v13.570.0, fuga de memoria en 4.6.0).
    # Ola 14 · R5TC-03b: 560 → 600 KB. En v13.602.1 el chunk midió 554.63 KB
    # gz (margen ~5 KB; en v13.583.2 era 539.7, ~15 KB/ola de crecimiento por
    # plantillas PDF nuevas y minors del renderer). 600 KB da ~2-3 olas de
    # colchón; si se rebasa, la acción es revisar el driver (deps nuevas del
    # chunk), no volver a subir el límite a ciegas.
    budget="${REACT_PDF_BUDGET_KB:-600}"

    label="lazy(react-pdf)"

  else
    budget="$LAZY_BUDGET_KB"
    label="lazy"
  fi


  if [ "$kb" -gt "$budget" ]; then
    echo "::error::Chunk $label '$name' = ${kb} KB excede budget ${budget} KB."
    FAIL=1
  fi
done

if [ "$FAIL" -eq 1 ]; then
  echo "::error::Bundle size gate FALLÓ. Revisa imports estáticos pesados o falta de lazy()."
  exit 1
fi

echo "✓ Bundle size OK (entry + lazy + vendor)"

