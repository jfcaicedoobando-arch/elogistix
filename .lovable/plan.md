## Objetivo

Identificar tests obsoletos, redundantes o de bajo valor dentro de los 724 tests actuales (108 archivos) y limpiarlos para que la suite refleje cobertura real, no inflada.

## Definición de "test obsoleto"

Un test es candidato a eliminar si cumple **al menos uno**:

1. **Huérfano duro**: importa un módulo/symbol que ya no existe (compilación falla o se silencia con cast).
2. **Duplicado**: misma aserción (mismo `describe` + `it` + mismo input/expectativa) en otro archivo, sin aportar caso adicional.
3. **Trivial**: solo verifica `expect(true).toBe(true)`, snapshot vacío, o re-exporta de un barrel sin lógica.
4. **Skipped/Todo abandonado**: `.skip`, `.todo`, `xit`, `xdescribe` sin issue/ticket asociado y >30 días sin tocar.
5. **Cobertura redundante**: el mismo branch/línea ya está cubierto por otro test más completo (medible con `--coverage` por archivo).
6. **Mocks rotos**: el mock no coincide ya con la firma real del módulo mockeado (la función cambió de aridad o retorno).

## Plan de auditoría — 4 sub-tareas

### 1. Auditoría automática (read-only, ~15 min)

Generar un reporte `docs/tests-audit.md` con 5 secciones:

- **Tests huérfanos** ya detectados (26 archivos). Para cada uno, clasificar:
  - *Falso positivo* (cubre múltiples archivos, sub-módulo, integración) → mantener.
  - *Real* (el source desapareció) → eliminar.
- **Skipped/Todo/Only**: `rg "\.(skip|todo|only)\(|xdescribe|xit\("` (actualmente 0, pero dejar el chequeo en CI).
- **Duplicados de descripción**: usar `grep | uniq -cd` (ya detectados 14 títulos repetidos — la mayoría son legítimos en archivos distintos, pero hay que revisar uno por uno).
- **Mocks rotos**: `bunx tsc --noEmit` solo sobre `**/*.test.ts` con `skipLibCheck=false`, detectar errores de tipo.
- **Cobertura redundante**: `bunx vitest run --coverage --reporter=json` → identificar tests cuyo único impacto en `coverage` ya está al 100% sin ellos (técnica: ejecutar suite excluyendo el archivo y comparar `% covered`).

### 2. Revisión manual de los 26 huérfanos

Para cada uno decidir:
- **Mantener** con comentario `// @cubre: <ruta>` arriba del archivo (explicar qué cubre y por qué no tiene par 1:1).
- **Renombrar** para que matchee el source (ej. `useEmbarquesListData.test.ts` → mover junto a `useEmbarquesListData.ts` si existe).
- **Eliminar** si el source ya no existe.

### 3. Eliminar duplicados confirmados

De los 14 títulos repetidos, conservar solo el caso más completo (con mejor cobertura de edge-cases). Documentar la decisión en el changelog.

### 4. Gate en CI (preventivo)

Añadir un script `scripts/audit-tests.ts` que falle el build si:
- Aparece nuevo `.only`, `.skip` o `.todo` sin comentario `// TODO(#issue):`.
- Aparece test huérfano nuevo (source no existe).
- Aparece import roto en archivo de test.

Ejecutar en `.github/workflows/ci.yml` como step adicional.

## Entregables

- `docs/tests-audit.md` con tabla por categoría y decisión por test.
- PR de limpieza (eliminaciones + renombres) con `CHANGELOG.md` listando exactamente qué se quitó y por qué.
- `scripts/audit-tests.ts` + step de CI.
- Suite final con N tests reales, sin pérdida de cobertura medible (`% lines/branches` igual o mayor).

## Detalles técnicos

- Tooling: `bunx vitest run --coverage`, `grep`, `rg`, `tsc --noEmit`, `knip` (ya configurado).
- No tocar: `src/integrations/supabase/types.ts`, `components/ui/*`, `e2e/*` (Playwright, no Vitest).
- Bump `APP_VERSION` patch por cada sub-tarea entregada (ej. 11.39.0 = reporte; 11.39.1 = limpieza; 11.39.2 = CI gate).
- Tests E2E (`e2e/specs/*.spec.ts`) quedan fuera de este alcance — son Playwright, no Vitest.

## Hallazgos preliminares (señales tempranas)

- 26 tests "huérfanos" sin source 1:1 — mayoría son falsos positivos (integración, edge-cases, architecture.test.ts), pero hay que confirmar uno por uno.
- 0 tests con `.skip/.only/.todo` ahora mismo (buena señal).
- 14 títulos `describe`/`it` repetidos exactos — algunos legítimos (mismo título en módulos distintos), otros podrían ser duplicación accidental.
- Suite actual: 108 archivos / 724 tests / ~45s end-to-end.

## ¿Continúo?

Si apruebas, ejecuto sub-tarea 1 (reporte automático) y te traigo el `docs/tests-audit.md` con tabla por test antes de borrar nada.