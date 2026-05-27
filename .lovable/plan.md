# Preparar corte de GA `12.0.0`

Objetivo: dejar **listo** todo lo automatizable para que, cuando la ventana de validación del RC termine sin show-stoppers, el corte a `12.0.0` sea un solo paso reproducible.

No se bumpea la versión a `12.0.0` en este plan — eso lo dispara el humano al cerrar QA.

## 1. Script de gate pre-GA

Crear `scripts/ga-gate.sh` (ejecutable, sin dependencias nuevas) que verifica en orden y aborta al primer fallo:

1. `bun test` → 770/770 verdes
2. `bun run lint` → 0 errores
3. `git diff --quiet CHANGELOG.md` → CHANGELOG tiene entrada `12.0.0` (no `-rc.*`)
4. `grep -q "12.0.0" src/constants/appVersion.ts` y NO contiene `-rc`
5. `grep -q "## \[12.0.0\] -" CHANGELOG.md`
6. Verifica que `docs/rc-qa-checklist.md` tiene todas las secciones §A-§N marcadas ✅
7. Verifica que `docs/rc-perf.md` no tiene placeholders `TODO` ni `<pendiente>`

Salida: tabla con ✓/✗ por check y exit code distinto de cero si algo falla.

## 2. Plantilla de comunicado de release

Crear `docs/templates/ga-announcement.md` en español (es-MX):

- Asunto sugerido
- Resumen ejecutivo (1 párrafo, no técnico)
- Lo nuevo desde `11.x` (3-5 bullets de alto nivel desde `release-notes-12.0.md`)
- Cambios de seguridad relevantes (sin filtrar detalles sensibles)
- Acciones requeridas por usuarios finales (none esperado)
- Contacto para reportar incidencias y ventana de hipercuidado (48h)

## 3. Procedimiento de corte GA documentado

Crear `docs/ga-cutover.md` con el checklist exacto que ejecutará el operador humano cuando la ventana cierre sin show-stoppers:

```text
1. Validar §N: QA ✅, perf ✅, rollback ✅
2. bash scripts/ga-gate.sh   # debe fallar primero porque versión aún es rc.1
3. Editar src/constants/appVersion.ts → "12.0.0"
4. Editar CHANGELOG.md → añadir "## [12.0.0] - <fecha>" copiando bullets de rc.1
5. Editar docs/release-notes-12.0.md → quitar "rc.1" del título y fecha
6. bash scripts/ga-gate.sh   # ahora debe pasar todo
7. Publicar (Publish button)
8. Tag interno + comunicado (docs/templates/ga-announcement.md)
9. Ventana de hipercuidado 48h: monitorear sentry + bitácora_actividad
```

## 4. Actualizar CHANGELOG y APP_VERSION

- Bump `APP_VERSION` → `"12.0.0-rc.1+gate"` **NO** — mantener `12.0.0-rc.1`.
- Añadir bullet en `CHANGELOG.md` bajo `[12.0.0-rc.1]` documentando los nuevos artefactos de gate (no nueva versión).

## Fuera de alcance

- Ejecutar el gate (requiere haber terminado QA manual)
- Bump a `12.0.0` (lo hace el humano al cerrar §N)
- Refactor de deuda aceptada (CC 13-15, casts MEDIUM)
- Seed de datos sintéticos para perf

## Archivos a tocar

- `scripts/ga-gate.sh` (nuevo, ejecutable)
- `docs/templates/ga-announcement.md` (nuevo)
- `docs/ga-cutover.md` (nuevo)
- `CHANGELOG.md` (bullet bajo `[12.0.0-rc.1]`)
- `src/pages/Changelog.tsx` (entrada nueva por convención del proyecto)

## Verificación

- `bash scripts/ga-gate.sh` ejecutado en estado actual (`rc.1`) debe fallar en el check #4 con mensaje claro — eso confirma que el gate **bloquea** cortes prematuros.
- `bun test` sigue verde tras los cambios (solo se añaden docs + script, no código de app).
