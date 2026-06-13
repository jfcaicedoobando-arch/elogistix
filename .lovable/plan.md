## Actualización de GitHub Actions a versiones más recientes

Actualizar todas las acciones de GitHub a sus últimas versiones estables en los 3 workflows: `ci.yml`, `e2e.yml`, `post-deploy-smoke.yml`.

### Cambios de versión

| Acción | Actual | Nueva |
|---|---|---|
| `actions/checkout` | v4 | **v6** |
| `actions/cache` | v4 | **v5** |
| `actions/upload-artifact` | v4 | **v7** |
| `actions/download-artifact` | v4 | **v8** |
| `actions/setup-node` | (revisar) | **v5** si aplica |
| `codecov/codecov-action` | v4 | **v7** |
| `oven-sh/setup-bun` | v2 | **v2** (ya en major actual) |
| `denoland/setup-deno` | v2 | **v2** (ya en major actual) |

### Consideraciones

- **upload-artifact v7 / download-artifact v8** son incompatibles con v4. Como ambos workflows del proyecto usan la misma versión (productor y consumidor son `ci.yml` internamente), se actualizan en conjunto sin riesgo externo.
- **checkout v6** requiere Node 20+ en el runner (ya estándar en `ubuntu-latest`).
- **codecov-action v7** mantiene la misma API con `token` y `files`; no requiere cambios de parámetros.
- No hay workflows externos consumiendo artifacts de este repo.

### Archivos a editar

1. `.github/workflows/ci.yml` — todas las acciones
2. `.github/workflows/e2e.yml` — checkout, setup-bun, upload-artifact
3. `.github/workflows/post-deploy-smoke.yml` — checkout

### Versionado y changelog

- Bump `APP_VERSION` a **12.97.1** (patch — solo CI infra)
- Entrada en `CHANGELOG.md`: "Actualización de GitHub Actions a versiones más recientes (checkout v6, cache v5, upload/download-artifact v7/v8, codecov v7)"

### Verificación post-cambio

- El primer push disparará los workflows; observar que pasen en verde.
- Si `download-artifact@v8` falla por incompatibilidad con uploads previos, revertir solo ese par a v4.

### Sin cambios funcionales

Cero impacto en código de aplicación, tests, o lógica de negocio.
