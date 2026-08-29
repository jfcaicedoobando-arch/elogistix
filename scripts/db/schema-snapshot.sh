#!/usr/bin/env bash
# schema-snapshot.sh — genera un snapshot NORMALIZADO del esquema `public`.
#
# Es la "radiografía de referencia" del esquema: incluye tablas, columnas,
# tipos/enums, índices, constraints (CHECK/FK/UNIQUE), triggers, cuerpos de
# funciones/RPCs, políticas RLS y GRANTs. NO incluye datos.
#
# Uso:
#   bash scripts/db/schema-snapshot.sh                       # a stdout (pg_dump local)
#   bash scripts/db/schema-snapshot.sh out.sql               # a archivo
#   bash scripts/db/schema-snapshot.sh out.sql <contenedor>  # pg_dump DENTRO del contenedor
#
# IMPORTANTE: el baseline del repo se genera con pg_dump 17.9 (contenedor pinneado).
# Un pg_dump de otra versión formatea distinto (p. ej. 15 no califica columnas
# de vistas con su alias) y produce diff falso: usá siempre el contenedor.
#
# El tercer argumento (o $SNAPSHOT_CONTAINER) hace que el dump se genere con el
# pg_dump de la imagen Postgres pinneada. Es la forma recomendada: distintas
# versiones de pg_dump formatean distinto y provocarían diffs falsos entre la
# máquina de un dev y CI.
#
# Determinismo: pg_dump emite los objetos en orden estable para una misma
# versión de servidor y un mismo orden de migraciones, que es justo lo que CI
# reproduce (base limpia + migraciones en orden). Aquí además se eliminan las
# líneas volátiles (comentarios de versión, OWNER TO, SET de sesión) que
# cambiarían el diff sin que el esquema cambie realmente.

set -euo pipefail

OUT="${1:-/dev/stdout}"
CONTAINER="${2:-${SNAPSHOT_CONTAINER:-}}"

DUMP_ARGS=(
  --schema-only
  --schema=public
  --no-owner
  --no-comments
  --no-tablespaces
  --no-security-labels
)

dump() {
  if [ -n "$CONTAINER" ]; then
    docker exec -e PGPASSWORD="${PGPASSWORD:-postgres}" "$CONTAINER" \
      pg_dump -U "${PGUSER:-postgres}" -d "${PGDATABASE:-postgres}" "${DUMP_ARGS[@]}"
  else
    command -v pg_dump >/dev/null 2>&1 || { echo "❌ pg_dump no está en PATH" >&2; exit 127; }
    pg_dump "${DUMP_ARGS[@]}"
  fi
}

TMP_OUT="$(mktemp)"
trap 'rm -f "$TMP_OUT"' EXIT

dump | sed -E \
  -e '/^--/d' \
  -e '/^SET /d' \
  -e '/^SELECT pg_catalog\.set_config/d' \
  -e '/^ALTER .* OWNER TO /d' \
  -e '/^\\(un)?restrict /d' \
  -e '/^[[:space:]]*$/d' \
  > "$TMP_OUT"

# --- Paridad ICU ---------------------------------------------------------
# `public.lc_unicode_upper` se crea con provider=icu y su migración la envuelve
# en un EXCEPTION handler: en un Postgres compilado SIN ICU (el del sandbox) la
# collation simplemente no nace y el snapshot saldría con una línea de menos que
# el de CI, produciendo un diff falso. Si el repo la declara y el dump no la
# trae, la reinsertamos justo después de `CREATE SCHEMA public;` (idempotente).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COLLATION_LINE="CREATE COLLATION public.lc_unicode_upper (provider = icu, locale = 'und');"
if ! grep -qF 'CREATE COLLATION public.lc_unicode_upper' "$TMP_OUT" \
   && grep -rqlF 'CREATE COLLATION public.lc_unicode_upper' "$REPO_ROOT/supabase/migrations" 2>/dev/null; then
  awk -v line="$COLLATION_LINE" '
    { print }
    !done && $0 == "CREATE SCHEMA public;" { print line; done = 1 }
  ' "$TMP_OUT" > "$TMP_OUT.icu"
  mv "$TMP_OUT.icu" "$TMP_OUT"
  echo "ℹ️  ICU ausente en este servidor: se reinsertó lc_unicode_upper para mantener paridad con CI." >&2
fi

cat "$TMP_OUT" > "$OUT"

