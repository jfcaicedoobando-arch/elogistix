## Problema

El lint del CI corre con `--max-warnings 0`, y `scripts/audit-migrations.ts` supera el límite de la regla `max-lines` (266 líneas contables contra un máximo de 250). No es un bug funcional: el archivo creció al agregar el reconocimiento de alias de tipos Postgres para el chequeo H6.

## Solución: dividir el script en módulos

Extraer las utilidades de análisis SQL a un módulo aparte, dejando en `scripts/audit-migrations.ts` únicamente la orquestación (constantes, `scanFile`, `main`).

Nuevo archivo `scripts/lib/audit-sql-signatures.ts` con:

- `splitTopLevelCommas`
- `normalizeArgTypes`
- `TYPE_ALIAS_GROUPS` y `typeVariants`
- `stripSqlComments`
- `extractParenArgs`
- `findSecurityDefinerFunctions`
- `scanSecurityDefiner`

`audit-migrations.ts` importa desde ese módulo y conserva el mismo comportamiento y salida en consola. Con esto ambos archivos quedan bajo el umbral de 250 líneas.

## Verificación

1. `bun run lint -- --max-warnings 0` sin advertencias.
2. `bun run audit:migrations` con la misma salida que hoy (sin violaciones H6 falsas).
3. Ejecutar las pruebas del script si existen (`rg` sobre `__tests__` de `audit-migrations`).

## Extras

- `CHANGELOG.md` + `APP_VERSION` a `13.336.2`.

Nota: no se baja el umbral de la regla `max-lines`; se refactoriza, conforme a la política del proyecto de no relajar los límites de calidad.
