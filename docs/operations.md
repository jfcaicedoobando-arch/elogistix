# Operaciones y recuperación — Libre Carga

Revisión documental: **2026-09-26**. No certifica backups disponibles,
plan contratado, cron activo, salud de Live ni permisos del operador.

## Fuentes y responsabilidades

Código en Git; base en Lovable Cloud/Supabase; CFDI en FacturAPI.
Ver [observabilidad](observability.md) y [seguridad](security-checklist.md).
El responsable autoriza recuperación, cambios de datos y publicación.
No subir secretos, documentos fiscales completos o datos personales a Git.

## Respaldos: verificar antes de depender de ellos

| Recurso | Confirmar en proveedor/panel |
| --- | --- |
| PostgreSQL | Último backup recuperable, retención, PITR disponible, permisos |
| Storage | Respaldo/restauración de archivos separado de la base |
| Auth/secretos | Procedimiento para reconstruir configuración |
| Integraciones | Webhooks y ambientes tras restore |
| RPO/RTO | Resultado medido de un simulacro |

Replicación de Storage no equivale a backup contra borrado.
No asumir siete días de retención, WAL continuo, RPO de cinco minutos o
RTO de treinta minutos sin evidencia del proveedor y un restore probado.

## Diagnóstico

1. Registrar entorno, hora UTC, SHA/versión, síntomas y alcance.
2. Revisar logs/bitácora y último cambio aplicado.
3. Revisar previamente `scripts/db/health-check.sql` e `integrity-guard.sql`;
   ejecutarlos sólo con acceso autorizado y conservar resultados.
4. Comparar con observaciones anteriores. Un threshold de alerta no
   demuestra corrupción por sí mismo.
5. Distinguir fallo de UI, API, datos, deploy o proveedor antes de restaurar.

No ejecutar bootstrap/post-migrate, seeds o suites con fixtures contra Live.

## Recuperación mínima

| Problema | Primera alternativa |
| --- | --- |
| Regresión frontend, datos sanos | Hotfix/rollback y publicación autorizada |
| Función defectuosa | Corregir/revertir función y verificar deploy |
| Migración incorrecta | Nueva migración correctiva revisada |
| Registros concretos erróneos | Reparación acotada autorizada con respaldo |
| Corrupción/pérdida amplia | Evaluar restore del proveedor en entorno aislado |

Restore de DB no revierte timbrados, cancelaciones ni transferencias reales.
Reconciliar proveedores externos antes de reemitir o reaplicar dinero.

## Restauración y simulacro

1. Confirmar respaldo, ámbito exacto, permisos y aprobación.
2. Preservar estado actual y acordar cómo evitar escrituras concurrentes.
   No desactivar una organización como supuesto modo mantenimiento.
3. Probar restore en instancia aislada según el proveedor; medir tiempos.
4. Verificar relaciones, archivos, roles, secretos y funciones.
5. Reconciliar CFDI y banco posteriores al punto restaurado.
6. Validar navegación y operación mock sólo en la instancia aislada.
7. Aprobar retorno de servicio y registrar incidente/seguimiento.

No sustituir RPCs con inserts manuales de facturas, conceptos o pagos:
eludiría invariantes, snapshots e idempotencia.

## Exports y cierre

Exports requieren acceso autorizado y almacenamiento protegido; separar
datos/schema/Storage y probar restauración fuera de Live.
Nunca usar `pg_restore --clean` contra producción como receta genérica.
No subir respaldos al repo; acordar retención con el responsable.

Merge, backend y publicación frontend se verifican por separado.
La ventana de validación la decide el responsable según riesgo; no se
presume un ciclo RC de duración fija.

Registrar causa, entorno, respaldo, datos afectados, tiempos medidos y
reconciliación fiscal/bancaria. [Referencia rápida](backups-rollback.md).
