## Qué pasa

GitHub Actions dejó de soportar Node.js 20. Nuestro workflow de CodeQL sigue apuntando a la versión v3.27.5 de la acción, que fue construida para Node 20. GitHub la sigue ejecutando, pero forzándola sobre Node 24 y avisando con un warning. Es una advertencia, no un fallo: el análisis de seguridad sigue corriendo. Pero conviene actualizar antes de que GitHub retire el modo de compatibilidad.

Analogía: es como un enchufe viejo que todavía funciona porque le pusimos un adaptador. Funciona hoy, pero mejor cambiar el enchufe.

## Verificación previa

Revisé las 13 acciones usadas en `.github/workflows`. Las únicas dos pinneadas a una versión que target Node 20 son:

- `github/codeql-action/init@f09c1c0a...` (v3.27.5) — `.github/workflows/codeql.yml:58`
- `github/codeql-action/analyze@f09c1c0a...` (v3.27.5) — `.github/workflows/codeql.yml:74`

El resto (`actions/checkout` v6.0.3, `actions/cache` v5.0.5, `actions/upload-artifact` v7.0.1, `setup-bun`, `setup-deno`, `codecov-action`, `gitleaks-action`, `dependency-review-action`, `github-script`, `download-artifact`) ya está en versiones que corren en Node 24 y no aparecen en el warning.

## Cambio propuesto

Actualizar ambos pins a **CodeQL Action v4.37.3**, la última release estable (consultada hoy vía la API de GitHub):

```
github/codeql-action/init@e4fba868fa4b1b91e1fdab776edc8cfbe6e9fb81    # v4.37.3
github/codeql-action/analyze@e4fba868fa4b1b91e1fdab776edc8cfbe6e9fb81 # v4.37.3
```

Se mantiene el estilo de pinning por SHA con el tag en comentario (política de seguridad del repo, validada por `actionlint` y `audit:migrations`).

### Detalles técnicos

- **v3 → v4 no rompe nuestra configuración**: los inputs que usamos (`languages`, `queries: security-and-quality`, `config` con `paths-ignore`, `category`) son idénticos en v4. El cambio mayor de v4 fue subir el runtime a Node 24 y retirar el soporte de CodeQL CLI muy antiguo, nada que nos afecte.
- **Se conserva** el env `CODEQL_ACTION_DIFF_INFORMED_QUERIES: "false"` (workaround de la v13.320.20 por el fetch shallow que rompía el `pr-diff-range.yml`). No lo quito en el mismo cambio para no mezclar dos variables: si después de la actualización queremos probar si v4 ya arregló ese bug, lo hacemos en un cambio aparte y medible.
- **Sin cambios de permisos**: v4 usa los mismos (`security-events: write`, `contents: read`, `actions: read`).

## Verificación

1. `bun run lint:actions` (actionlint) para confirmar que el YAML sigue válido.
2. El propio job "Analyze (javascript-typescript)" en el siguiente push: debe terminar en verde y **sin** el warning de Node 20.

## Cierre

- Bump de `APP_VERSION` a `13.320.64` y entrada en `CHANGELOG.md`.
