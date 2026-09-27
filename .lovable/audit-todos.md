# Auditoría — pendientes por verificar

Revisión de inventario Git: **2026-09-26**. No implica auditoría de Live.

| ID | Referencia | Estado |
| --- | --- | --- |
| AUDIT-M16 | `.env` sigue trackeado aunque `.gitignore` lo excluye | Higiene pendiente de decisión; no hace falta purga histórica automática |

[Procedimiento](../docs/ops/purga-env-git.md).
No reescribir historia ni rotar claves públicas sólo para cerrar una casilla.
Cualquier credencial privada expuesta sí requiere rotación.

[Otros pendientes históricos](../docs/auditoria/pendientes-historicos.md)
necesitan verificación antes de declararse bugs actuales o cerrados.

TODOs productivos nuevos: prefijo `AUDIT(<id>)` y referencia al issue/registro
que describa evidencia, responsable y cierre.
