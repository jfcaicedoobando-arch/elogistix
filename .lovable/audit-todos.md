# Auditoría — TODOs accionables abiertos

Fuente única de verdad para trabajo futuro identificado durante la auditoría
arquitectónica. Sólo entries con valor real.

| ID | Archivo | Descripción | Bloqueo |
|---|---|---|---|
| AUDIT-M16 | `.env` | Sigue en el índice de git aunque ya está en `.gitignore`. Procedimiento completo en [`docs/ops/purga-env-git.md`](../docs/ops/purga-env-git.md). Verificado el 2026-08-29: el archivo sólo contiene variables públicas, así que es higiene de repo, no fuga de credenciales. | Reescritura de historial de git (manual, fuera del agente) |

## Convención

Todo `TODO` futuro en código productivo debe usar el prefijo `// AUDIT(<id>)`
y referenciar una fila en esta tabla. Si la deuda se cierra, eliminar el
comentario **y** la fila aquí.
