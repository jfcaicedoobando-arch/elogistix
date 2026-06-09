# Pinear GitHub Actions a versiones exactas

## Contexto

La auditoría flageó `actions/checkout@v6` y `actions/upload-artifact@v7` como "inestables" porque apuntar a un tag mayor flotante (v6, v7) puede romper el build si GitHub publica una v6.x.y con un cambio de comportamiento. Las releases más recientes verificadas hoy son:

- `actions/checkout` → **v6.0.3** (2 jun 2026, firmada GPG)
- `actions/upload-artifact` → **v7.0.1** (10 abr 2026, firmada GPG)
- `actions/download-artifact` → última estable de la familia v7 (misma org/cadencia que upload)

## Cambios

### `.github/workflows/ci.yml`

Reemplazar los tags flotantes por versiones exactas en los 3 jobs (`quality`, `tests`, `coverage`):

| Antes | Después |
|---|---|
| `actions/checkout@v6` | `actions/checkout@v6.0.3` |
| `actions/upload-artifact@v7` | `actions/upload-artifact@v7.0.1` |
| `actions/download-artifact@v7` | `actions/download-artifact@v7.0.1` |

`oven-sh/setup-bun@v2` con `bun-version: latest` se deja igual (es la recomendación oficial del action).

### `.github/workflows/post-deploy-smoke.yml`

Revisar y aplicar el mismo pin si usa `checkout`/`upload-artifact`/`download-artifact` con tag flotante.

## Detalles técnicos

- Pinear a `vX.Y.Z` (no a SHA) es el equilibrio entre seguridad y mantenibilidad que ya usamos en el resto del proyecto.
- No se cambia lógica de CI, ni sharding, ni umbrales — sólo las versiones.
- Bump de `APP_VERSION` (patch) + entrada breve en `CHANGELOG.md` siguiendo la regla de proyecto.

## Validación

- `bun run lint` y `bun run audit:tests` localmente (no tocan YAML pero confirman que nada se rompió).
- La validación real ocurre en el primer PR: los 3 jobs deben resolverse a los tags exactos sin warning de "unstable".

## Fuera de alcance

- Migrar a SHA pinning de toda la org (mayor superficie).
- Reducir shards de 16 → 8 (punto separado del audit, decisión aparte).
