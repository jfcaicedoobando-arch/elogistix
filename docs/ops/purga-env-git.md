# P3 — Sacar `.env` del historial de Git

**Estado:** pendiente de ejecución manual. Última verificación del contenido de `.env`: **2026-08-29 (v13.795.0)** — sigue conteniendo sólo las 6 variables públicas listadas abajo, ninguna credencial privada. Lovable no puede reescribir el historial del repositorio desde el chat, así que estos pasos se corren en tu máquina.

**Analogía:** `.gitignore` es como cerrar la puerta de la bodega: evita que entren cajas nuevas. Pero la caja que ya está adentro sigue ahí hasta que alguien la saca. Este documento es el instructivo para sacarla.

## 1) Qué contiene hoy el archivo

Variables presentes en `.env` (sólo nombres, nunca valores):

| Variable | Sensibilidad |
|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | Pública (viaja en el bundle del navegador) |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Pública (llave publicable; la protección real es RLS) |
| `VITE_SUPABASE_PROJECT_ID` | Pública |
| `VITE_SENTRY_DSN` | Pública (los DSN de Sentry son de ingesta, no de lectura) |

**Conclusión importante:** hoy **no hay ninguna credencial privada** en el archivo. No hay llave de servicio ni contraseña de base de datos. Por eso la purga es **higiene**, no una fuga que obligue a rotar llaves de inmediato.

Antes de purgar, confirma que sigue siendo así:

```bash
cut -d= -f1 .env        # sólo nombres
git log --oneline -- .env
```

Si en algún commit histórico aparece un secreto real (`SERVICE_ROLE`, `SECRET`, `PASSWORD`, `TOKEN`, `API_KEY`), **rota primero** esa credencial y después purga.

## 2) Dejar de rastrear el archivo (mínimo indispensable)

Esto lo puedes hacer hoy mismo; no reescribe historial:

```bash
git rm --cached .env
git commit -m "chore(ops): dejar de rastrear .env (P3)"
```

`.gitignore` ya lo excluye (líneas `.env` y `.env.*`), así que no volverá a entrar.

## 3) Purga del historial (opcional, requiere coordinación)

Sólo si quieres borrarlo también de los commits antiguos. Reescribe el historial: **avisa a todo el equipo antes**, porque las copias locales quedan desincronizadas.

Opción recomendada, `git filter-repo`:

```bash
# 1. Respaldo completo (imprescindible)
git clone --mirror . ../elogistix-backup.git

# 2. Instalar la herramienta (una vez)
#    macOS: brew install git-filter-repo
#    o: pipx install git-filter-repo

# 3. Purgar el archivo de todo el historial
git filter-repo --invert-paths --path .env

# 4. Publicar el historial reescrito
git push --force --all
git push --force --tags
```

Alternativa sin instalar nada (más lenta, mismo efecto):

```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all
```

Después de la reescritura, cada persona del equipo debe volver a clonar el repositorio (no `git pull`).

## 4) Verificación

```bash
git ls-files | grep -x '.env'          # sin resultados
git log --oneline --all -- .env        # sin resultados
git check-ignore -v .env               # debe reportar la regla de .gitignore
```

Y confirma que el archivo local sigue existiendo (la app lo necesita para compilar):

```bash
test -f .env && echo "ok: .env local presente"
```

## 5) Si hubiera que rotar

Sólo aplica cuando el historial contenga una credencial privada. Orden sugerido:

1. Rotar la llave en el proveedor (backend de Lovable Cloud para llaves de Supabase; Sentry para el DSN).
2. Actualizar el valor en el `.env` local y en los secretos del proyecto.
3. Verificar que la app publicada sigue funcionando.
4. Recién entonces invalidar la llave anterior.

> Nota: en Lovable Cloud la llave de servicio (`service_role`) y la contraseña de la base de datos no son accesibles ni se guardan en `.env`, así que no forman parte de este procedimiento.
