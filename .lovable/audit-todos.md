# Auditoría — TODOs accionables abiertos

Fuente única de verdad para trabajo futuro identificado durante la auditoría
arquitectónica (bloques 13.56.1 → 13.56.7). Sólo entries con valor real.

| ID | Archivo | Descripción | Bloqueo |
|---|---|---|---|
| AUDIT-M16 | `.env` | El archivo sigue en el índice de git aunque ya está en `.gitignore`. Requiere `git rm --cached .env` (operación de git fuera del agente) y, recomendado, rotar las llaves publicables. Riesgo: higiene de repo, no fuga de credenciales. | Operación manual de git |

## Convención

Todo `TODO` futuro en código productivo debe usar el prefijo `// AUDIT(<id>)`
y referenciar una fila en esta tabla. Si la deuda se cierra, eliminar el
comentario **y** la fila aquí.
