#!/usr/bin/env bash
# schema-snapshot.sh — genera un snapshot NORMALIZADO del esquema `public`.
#
# Es la "radiografía de referencia" del esquema: incluye tablas, columnas,
# tipos/enums, índices, constraints (CHECK/FK/UNIQUE), triggers, cuerpos de
# funciones/RPCs, políticas RLS y GRANTs. NO incluye datos.
#
# Uso (requiere PG* apuntando a la base ya migrada):
#   bash scripts/db/schema-snapshot.sh                 # a stdout
#   bash scripts/db/schema-snapshot.sh out.sql         # a archivo
#
# Determinismo: pg_dump emite los objetos en orden estable para una misma
# versión de servidor y un mismo orden de migraciones, que es justo lo que CI
# reproduce (base limpia + migraciones en orden). Aquí se eliminan además las
# líneas volátiles (comentarios de versión, OWNER TO, SET de sesión) que
# cambiarían el diff sin que el esquema cambie.

set -euo pipefail

OUT="${1:-/dev/stdout}"

command -v pg_dump >/dev/null 2>&1 || { echo "❌ pg_dump no está en PATH" >&2; exit 127; }

pg_dump \
  --schema-only \
  --schema=public \
  --no-owner \
  --no-comments \
  --no-tablespaces \
  --no-security-labels \
  | sed -E \
      -e '/^--/d' \
      -e '/^SET /d' \
      -e '/^SELECT pg_catalog\.set_config/d' \
      -e '/^ALTER .* OWNER TO /d' \
      -e '/^[[:space:]]*$/d' \
  > "$OUT"
