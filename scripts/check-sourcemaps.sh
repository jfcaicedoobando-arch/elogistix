#!/usr/bin/env bash
# scripts/check-sourcemaps.sh — Guard de sourcemaps públicos (P2 auditoría stack).
#
# Política: el `dist` que el hosting sirve NO debe contener `.map` ni
# referencias `sourceMappingURL` a archivos servidos. Con `SENTRY_AUTH_TOKEN`
# el plugin de Sentry los sube y los borra (`filesToDeleteAfterUpload`); sin
# token, `vite.config.ts` directamente no los genera.
#
# Uso: bash scripts/check-sourcemaps.sh   (después de `bun run build`)
set -euo pipefail

DIST_DIR="${DIST_DIR:-dist}"

if [ ! -d "$DIST_DIR" ]; then
  echo "::error::Directorio $DIST_DIR no existe. ¿Corriste 'vite build' antes?"
  exit 1
fi

MAPS=$(find "$DIST_DIR" -type f -name '*.map' | head -20)
if [ -n "$MAPS" ]; then
  echo "::error::Hay sourcemaps en $DIST_DIR — se servirían públicamente:"
  echo "$MAPS"
  echo "Causa habitual: build de producción con sourcemaps pero sin subida/borrado por Sentry."
  exit 1
fi

# `sourceMappingURL` apuntando a un archivo del bundle es una fuga equivalente.
REFS=$(grep -rlE 'sourceMappingURL=[^ ]+\.map' "$DIST_DIR" --include='*.js' --include='*.css' || true)
if [ -n "$REFS" ]; then
  echo "::error::Archivos con referencia a sourcemap (deberían usar sourcemap 'hidden' o ninguno):"
  echo "$REFS"
  exit 1
fi

echo "✓ Sourcemaps OK: ningún .map ni referencia sourceMappingURL en $DIST_DIR"
