# Actualizar GitHub Actions a versiones con Node.js 24

## Problema
El workflow de CI emite warnings de deprecación porque `actions/checkout@v4` y `actions/upload-artifact@v4` ejecutan Node.js 20, que será removido de los runners el 16 de septiembre de 2026. A partir del 16 de junio de 2026, las acciones serán forzadas a Node.js 24 por defecto.

## Solución
Actualizar las acciones de GitHub a las últimas versiones mayores que ya corren nativamente sobre Node.js 24:

### Cambios en `.github/workflows/ci.yml`

| Acción | Versión actual | Versión nueva |
|--------|---------------|---------------|
| `actions/checkout` | v4 | v6 |
| `actions/upload-artifact` | v4 | v7 |
| `actions/download-artifact` | v4 | v7 |

### Ubicaciones a modificar
- `actions/checkout@v4` → `actions/checkout@v6` en los 3 jobs (`quality`, `tests`, `coverage`)
- `actions/upload-artifact@v4` → `actions/upload-artifact@v7` en los pasos de upload de `quality` y `tests`
- `actions/download-artifact@v4` → `actions/download-artifact@v7` en el job `coverage`

## Consideraciones
- `actions/checkout@v6` fue lanzada específicamente para migrar a Node.js 24.
- `actions/upload-artifact@v7` (y su par `download-artifact`) también corren sobre Node.js 24.
- No hay breaking changes relevantes para este workflow (los artifacts siguen funcionando igual para reportes y coverage).

## Archivos involucrados
- `.github/workflows/ci.yml`
- `CHANGELOG.md` (registro de cambios)
- `src/constants/appVersion.ts` (bump de versión)