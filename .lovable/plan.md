# Guardar preferencia: cerrar issues de Sentry al arreglarlos

## Cambios

1. Crear `mem://preferences/sentry-resolve` con la regla: siempre que se corrija un error reportado por Sentry (después de mergear/desplegar el fix), marcar el/los issues como `resolved` usando `update_issue`. Incluir el issue ID en el CHANGELOG y en el mensaje al usuario.

2. Actualizar `mem://index.md`:
   - Añadir línea en **Core**: "Al corregir un bug reportado por Sentry, marcar el issue como `resolved` con `update_issue` en el mismo turno del fix."
   - Añadir referencia en **Memories** al archivo nuevo.

Sin cambios de código.
