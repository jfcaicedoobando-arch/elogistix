# Auditoría — TODOs accionables abiertos

Fuente única de verdad para trabajo futuro identificado durante la auditoría
arquitectónica (bloques 13.56.1 → 13.56.7). Sólo entries con valor real.

| ID | Archivo | Descripción | Bloqueo |
|---|---|---|---|
| AUDIT-17.1 | `src/features/cotizacion/services/conversiones/portal.ts:18` | Reactivar `send-transactional-email` con template `cotizacion-respuesta` para notificar al operador cuando un cliente responde desde el portal. | Configurar dominio de email + registrar template en `registry.ts`. |

## Convención

Todo `TODO` futuro en código productivo debe usar el prefijo `// AUDIT(<id>)`
y referenciar una fila en esta tabla. Si la deuda se cierra, eliminar el
comentario **y** la fila aquí.
