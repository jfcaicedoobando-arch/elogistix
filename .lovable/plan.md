# Plan: compactación real (squash) del historial de la base

Objetivo: reemplazar los ~1,580 archivos de cambios (antiguos + nuevos) por **un solo punto de partida** que reproduzca exactamente la base actual, sin tocar datos ni lo que ya corre en producción.

Analogía: pasar el libro de actas a limpio en un tomo nuevo, guardando el libro viejo en el archivo muerto, y comprobando renglón por renglón que el tomo nuevo dice lo mismo.

## Fase 0 — Precondiciones (bloqueantes)
1. Investigar en modo lectura el cambio registrado en la base sin archivo (entre 0021 y 0022). Si no se identifica, se documenta como "absorbido por el punto de partida" y requiere tu visto bueno.
2. Congelar cambios a la base: ninguna migración nueva ni draft abierto durante el squash. Confirmar que no hay trabajo concurrente.
3. Tu autorización explícita para: crear migración nueva, cambiar versión/changelog y ajustar las pruebas de historial (guards) que hoy prohíben tocar archivos.

## Fase 1 — Generar el punto de partida
1. Extraer el esquema vivo de producción (sólo estructura: tablas, funciones, triggers, RLS, permisos, tipos, extensiones). Sin datos, excepto catálogos semilla que hoy vienen de migraciones (se listan y revisan uno por uno).
2. Compararlo contra `supabase/schema/baseline.sql` y contra una reconstrucción limpia del historial actual. Toda diferencia se explica antes de seguir (son drift real).
3. Escribir el punto de partida como migración `0000_baseline` en un historial nuevo.

## Fase 2 — Cambio de historial sin re-ejecutar nada en producción
1. En producción, marcar el punto de partida como "ya aplicado" sin correr su SQL (sólo registro en la tabla de control del historial), usando la herramienta oficial de historial; si no lo permite, se detiene y se reporta.
2. Mover los archivos viejos a `archive/` (fuera de la carpeta que se reproduce), conservándolos para trazabilidad fiscal/auditoría.
3. Conservar la copia actual de la tabla de control del historial en un respaldo de sólo lectura.

## Fase 3 — Verificación
1. Reconstrucción limpia desde cero con el nuevo historial → el esquema resultante debe ser idéntico byte a byte (normalizado) al de producción.
2. Pruebas SQL de guards del manifiesto y pruebas focalizadas de scripts de historial, actualizadas al nuevo esquema de un solo punto de partida.
3. `db:postcheck` + baseline regenerada idéntica.
4. CI/RLS/E2E completos: en GitHub Actions, no localmente.

## Fase 4 — Cierre
- Actualizar `AGENTS.md` (regla de historial compactado y dónde vive el archivo muerto), changelog y versión (con tu autorización).
- Plan de reversa: restaurar carpetas y tabla de control desde el respaldo; producción no cambia de esquema en ningún paso.

## Riesgos
- Las auditorías de historial y replay (0035, historial aislado, espejo) están diseñadas para fallar ante esto: hay que rediseñarlas, no debilitarlas.
- Drafts o ramas abiertas quedarían incompatibles.
- Beneficio práctico bajo: no libera espacio en la base (852 MB no cambian).

## Detalles técnicos
- Herramientas: `lov_database--migration_history` (inspect/repair) para el registro; `lov_database--migration` sólo si se requiere SQL; nunca edición manual bajo `drizzle/`.
- Archivos afectados: `drizzle/migrations/*`, `drizzle/replay.json`, `scripts/ci/drizzle-history/*`, `scripts/lib/replayMirrorDrizzle0035.ts`, `supabase/migrations/*` (a archivo), pruebas en `src/__tests__/scripts/`.
- Si la plataforma no permite registrar el punto de partida sin ejecutarlo, el squash se detiene en Fase 1 (sólo se entrega el archivo de esquema como referencia).
