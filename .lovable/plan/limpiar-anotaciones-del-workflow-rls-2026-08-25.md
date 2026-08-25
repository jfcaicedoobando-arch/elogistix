# Limpiar anotaciones del workflow RLS

## Objetivo
Eliminar las siete advertencias y el aviso informativo que ensucian un run exitoso, sin ocultar fallos reales de migraciones, suites ni drift.

## Cambios
1. **Artifacts de suites**
   - Garantizar que cada job matricial cree su carpeta y manifiesto de logs incluso si una etapa previa falla o el job se cancela parcialmente.
   - Mantener `if: always()` y convertir la ausencia del artifact en error real, porque después del sembrado ya no debe faltar.

2. **Baseline de esquema**
   - Incorporar `supabase/schema/baseline.sql` generado desde el snapshot normalizado de PostgreSQL 15.8 usado por CI.
   - Cambiar el guard para que una baseline ausente sea un error accionable, no una advertencia permanente.

3. **Migración anclada**
   - Conservar la exención documentada en `drift-anclas.txt`, pero registrar el caso en el resumen del job en vez de emitir anotaciones `warning`/`notice` sobre una condición conocida y cubierta por una reaplicación posterior.
   - Mantener el fallo estricto para cualquier migración nueva no exenta que no aplique en limpio.

4. **Trazabilidad**
   - Incrementar `APP_VERSION` y documentar el ajuste en `CHANGELOG.md`.

## Validación
- Validar sintaxis y contratos del workflow.
- Confirmar que el baseline coincida con un snapshot limpio de las migraciones.
- Ejecutar las suites RLS o, si el entorno local no permite reproducir Docker, verificar los scripts y guards equivalentes sin relajar ninguna condición de seguridad.
