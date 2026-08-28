# Actualizar las GitHub Actions seguras

Objetivo: subir las acciones de CI a su versión más reciente **sin riesgo de romper el pipeline**. Todas quedan ancladas por SHA (como ya está el repo) con el comentario de versión al lado.

## Qué se actualiza (seguro)

Son subidas dentro de la misma versión mayor: mismo comportamiento, mismos parámetros, sólo correcciones. Es como cambiar el aceite del coche, no el motor.

| Acción | Actual | Nueva | Archivos |
| --- | --- | --- | --- |
| `actions/checkout` | v6.0.3 | v6.1.0 | 27 usos en todos los workflows |
| `actions/cache` | v5.0.5 | v5.1.0 | 9 usos (ci, e2e, rls-tests) |
| `denoland/setup-deno` | v2.0.4 | v2.0.5 | 2 usos |
| `github/codeql-action/{init,analyze}` | v4.37.3 | v4.37.9 | codeql.yml |

Nota sobre `checkout` v6.1.0: el changelog lo marca "BREAKING" sólo por el nuevo control `allow-unsafe-pr-checkout` en flujos `pull_request_target`. Ningún workflow del repo usa ese disparador, así que no aplica.

Ya están en la última versión y no se tocan: `actions/upload-artifact` v7.0.1, `actions/download-artifact` v8.0.1, `gitleaks/gitleaks-action` v3.0.0.

## Qué NO se actualiza en este cambio (mayores)

Se dejan igual porque cambian el runtime (Node 24) o el empaquetado, y pueden requerir ajustes de scripts. Quedan documentadas para decidirlas aparte:

- `actions/checkout` v7.0.1
- `actions/cache` v6.1.0 (migración a ESM)
- `actions/github-script` v9.0.0 (v8 sigue siendo la última de la línea actual)
- `dorny/paths-filter` v4.0.3 (Node 24)
- `actions/dependency-review-action` v5.0.0 (Node 24)

## Detalle técnico

SHAs verificados contra la API de GitHub (tags desreferenciados):

```text
actions/checkout            d23441a48e516b6c34aea4fa41551a30e30af803 # v6.1.0
actions/cache               caa296126883cff596d87d8935842f9db880ef25 # v5.1.0
denoland/setup-deno         22d081ff2d3a40755e97629de92e3bcbfa7cf2ed # v2.0.5
github/codeql-action/*      cdf488f595d80d6e07e03d4674febd5ab45fa938 # v4.37.9
```

Pasos:
1. Reemplazo global de los 4 pares SHA+comentario en `.github/workflows/*.yml` (actionlint, ci, codeql, dependency-review, e2e, gitleaks, post-deploy-smoke, rls-tests).
2. Validar sintaxis con `actionlint` local si está disponible (el repo ya tiene ese workflow).
3. `CHANGELOG.md` + `APP_VERSION` → `13.782.2` (regla del proyecto).
