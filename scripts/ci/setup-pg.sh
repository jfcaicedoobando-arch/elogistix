#!/usr/bin/env bash
set -euo pipefail
set -euo pipefail
ver="17"
if command -v pg_dump >/dev/null 2>&1 \
  && pg_dump --version | grep -qE "^pg_dump \(PostgreSQL\) ${ver}\."; then
  echo "✓ pg_dump ${ver} ya presente: $(pg_dump --version)"
else
  sudo install -d -m 0755 /usr/share/keyrings
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | sudo gpg --dearmor -o /usr/share/keyrings/pgdg.gpg
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt ${codename}-pgdg main" \
    | sudo tee /etc/apt/sources.list.d/pgdg.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq "postgresql-client-${ver}"
fi
# PGDG instala en /usr/lib/postgresql/<ver>/bin; lo ponemos primero
# para ganarle al cliente 16 preinstalado del runner.
echo "/usr/lib/postgresql/${ver}/bin" >> "$GITHUB_PATH"

set -euo pipefail
psql --version
pg_dump --version
pg_restore --version
