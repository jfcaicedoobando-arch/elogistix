# Vitest 5.1.0: actualización atómica y cobertura

## Alcance

Partiendo de `main` `42d6b9e514720c1f055330c77cfdd7e6d839cb90`, actualizar juntos
`vitest` y `@vitest/coverage-v8` de 5.0.5 a 5.1.0. El lockfile se regeneró con
Bun 1.4.4; sólo cambia esta familia y sus bibliotecas de cobertura.

Los PR #452 y #453 proponían una mitad cada uno. Los peers publicados exigen
la misma versión exacta. No se incluyen las otras 19 actualizaciones de #453,
no se cierran los PR originales y no se ejecutan migraciones ni despliegues.

## Prevención

- Mantener ambos pins exactos y comprobar manifiesto, workspace del lockfile,
  resoluciones y peers instalados en `bun run test:dependencies`.
- Incluir explícitamente el provider en los grupos Vitest y excluir toda la
  familia del grupo general de Dependabot. La prueba comprueba precedencia y
  selección para major/minor/patch. Esto no demuestra la causa interna de la
  separación anterior ni sustituye la revisión del siguiente PR del bot.
- Rechazar fixtures con cualquiera de las dos actualizaciones aisladas,
  un lock obsoleto o una instalación obsoleta.
- Usar `.vitest/blob` al fusionar reportes. Vitest 5 escribe allí por defecto;
  la ruta anterior `.vitest-reports` no recibía los blobs nuevos.
- Ejecutar los scripts reales de cobertura en un fixture local: dos shards
  producen dos blobs y el merge conserva 100% de líneas, funciones, sentencias
  y ramas. No se usan red externa, base de datos ni credenciales.

## Verificación local

Node 26.13.0 y Bun 1.4.4:

- Instalación congelada con scripts de instalación deshabilitados: PASS.
- `bun run test:dependencies`: 29/29 PASS, incluidos cuatro contratos nuevos.
- Contratos de scripts de paquetes: 4/4 PASS.
- Selección de benchmarks, reparto de entornos y shards Vitest: 62/62 PASS
  en tres archivos, máximo dos workers.
- ESLint de los tres archivos JavaScript modificados: PASS, cero warnings.
- Censo de tests: PASS; el contrato nuevo tiene lane automática
  `node-dependency-security`.
- `git diff --check`: PASS.
- `bun run lint:unused`: FAIL por dos plugins de preview Lovable no usados
  y el tipo exportado `CoordinadorOption`, presentes en la base sin cambios
  por este PR. No se ocultan ni se relaja Knip.
- `bun run typecheck`: bloqueado por SIGKILL del entorno compartido, incluso
  limitando el heap a 2 GiB. No se interpreta como comprobación exitosa.

La suite completa de 2,515 archivos Vitest, ESLint global, build y CI requerido
siguen siendo condiciones de integración, no resultados de este pase local.
No fusionar ni cerrar #452/#453 hasta tener una base sana y verificar el SHA
final con los otros cambios de dependencias.

## Actualización tras integrar #456

- Base incorporada: `ca5181833f3fbf8ee165d0fddd9cf3d8e24b26a3`.
- Corregida la lista explícita del contrato `ciTestEvidence.test.ts` para
  reconocer el archivo nuevo, manteniendo el chequeo exacto de rutas.
- Knip completo y los 38 tests de catálogo, coordinador e inventario: PASS.
- CI anterior: typecheck/build/Deno, Dependency Review y UI aislada PASS.
  El contrato de catálogo omitido y la base anterior bloquearon el agregador.
- RLS anterior sigue investigándose por un contrato de identidad CRM ajeno
  a estos cambios; no se omite el job ni se declara verde por inferencia.
