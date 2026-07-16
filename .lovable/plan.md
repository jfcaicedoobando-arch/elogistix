## Problema

En el job `quality` de `.github/workflows/ci.yml`, el paso "Architecture & cast report" corre `bun run audit:report` con `if: always()`. Cuando el paso previo `Setup Bun + install` falla (por ejemplo, un hiccup de red al descargar Bun o al hacer `bun install`), los pasos con `always()` intentan ejecutar `bun` de todos modos y se cae con `bun: command not found` (exit 127). Lo mismo aplica a "PR summary (audit report)" y "Upload audit report".

Analogía: es como intentar cocinar cuando aún no llegó el gas — la olla (bun) no existe, así que la receta (`audit:report`) truena antes de empezar.

## Fix

1. Darle un `id` al step de Setup Bun (`id: setup-bun`) en `.github/workflows/ci.yml`.
2. Cambiar la condición de los steps que corren después con `if: always()` para que sólo se ejecuten cuando Bun quedó instalado:
   - `Architecture & cast report` → `if: always() && steps.setup-bun.outcome == 'success'`
   - `PR summary (audit report)` → `if: always() && github.event_name == 'pull_request' && steps.setup-bun.outcome == 'success'`
   - `Upload audit report` se queda con `if: always()` (no usa `bun`, sólo sube archivos si existen).

Con esto, si Bun no se instaló, el job falla con el error real (el de setup-bun) en vez de enmascararlo con `command not found`.

## Alcance

- Un solo archivo tocado: `.github/workflows/ci.yml`.
- Sin cambios de código de aplicación, sin bump de `APP_VERSION`, sin entrada de `CHANGELOG.md` (es sólo infraestructura de CI). Si prefieres registrarlo igual, avísame y lo agrego.

## Recomendación complementaria

Este error normalmente es transitorio. Antes/después del fix, puedes re-correr el job fallido en GitHub Actions ("Re-run failed jobs") — si vuelve a fallar en `Setup Bun + install`, ahí veremos el error real (red, cache corrupto, etc.) sin el ruido del `command not found`.
