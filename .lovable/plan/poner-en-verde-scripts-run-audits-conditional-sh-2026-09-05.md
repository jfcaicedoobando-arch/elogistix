# Poner en verde `scripts/run-audits-conditional.sh`

Tres auditorías fallan. Ninguna es un bug de producto: son candados de higiene que quedaron desincronizados tras la última ronda de cambios en CRM. Alcance mínimo, sin tocar lógica de negocio.

## 1. `audit:manifest` — falta la entrada de la versión actual

El manifiesto de releases (`supabase/releases/migration-manifest.json`) no tiene entrada para `APP_VERSION 13.823.140`.

Arreglo: regenerar el manifiesto con el script oficial (`db:release-manifest:update`) y dejarlo commiteado.

## 2. `audit:soft-delete` — baseline con 2 entradas ya corregidas

Los filtros `deleted_at` que se agregaron en `src/features/crm/services/etapas.ts` y `src/features/crm/services/lineage.ts` ya están bien, pero siguen listados como "pendientes" en la baseline. El guardrail exige quitar lo que dejó de fallar.

Arreglo: regenerar la baseline con `audit:soft-delete -- --update`. No se toca el código de consultas.

## 3. `audit:tests` — 10 violaciones de higiene de pruebas

- **Sin `expect` visible (2)** en `UnifiedFiltersBar.limpiarBusqueda.test.tsx`: las aserciones viven dentro del helper `esperarSinBusqueda`, y el auditor sólo mira dentro del bloque `it`. Arreglo: agregar una aserción explícita en cada prueba (además del helper), sin cambiar lo que se verifica.
- **`rejects` débil (1)** en `automatizacionesEtapa.test.ts:59`: `rejects.toBeTruthy()` no comprueba nada útil. Arreglo: afirmar el mensaje real del error propagado (`rls`).
- **Títulos duplicados (7)**: varias pruebas nuevas comparten el mismo texto en archivos distintos (avisos duplicados, ConvertirLead A→B, contador singular, "propaga el error de la RPC"). Arreglo: renombrar cada título para incluir su contexto (por ejemplo "ActividadNotasSheet · si falla no repite el aviso"), sin cambiar el contenido de las pruebas. No se agregan entradas a la allowlist.

## Cierre

- Bump de patch en `APP_VERSION` + entrada en `CHANGELOG.md`.
- Validación focalizada: los archivos de prueba tocados, más `audit:tests`, `audit:manifest` y `audit:soft-delete`. CI/RLS completos quedan para GitHub Actions.
