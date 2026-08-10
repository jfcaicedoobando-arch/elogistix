# Ola 3 — verificación de cierre y pendientes reales

Revisé los dos documentos subidos contra el código y la base de datos actuales. Casi todo ya está aplicado; queda un pendiente real y dos ítems que afectan cero datos.

## Estado verificado (ya aplicado, no requiere trabajo)

- Altas y parciales del primer documento: pantalla `/sin-acceso` (RG1), RFC genérico en la conversión de prospectos (RG2), bypass de super admin (RG3b), RPC transaccional de ajustes de proveedor (P1), listados de usuarios fail-closed (P2), invalidaciones de caché al marcar costo pagado (P4).
- Medias y bajas: RG4, RG5, RG6, RG7, RG8, RG9, RG10, RG11, RG12, RG13, RG14, RG15, RG16, RG17, RG18, RG19, RG20, RG21, RG22, RG23 están implementados (frontend en la versión 13.479.0 y SQL en la 13.480.0).

## Pendiente real

**P3 — archivo de variables de entorno versionado.** Sigue registrado en el control de versiones aunque `.gitignore` ya lo excluye. Quitarlo del historial es una operación de repositorio (reescritura de historial) que no puedo ejecutar desde aquí, y además implica rotar las llaves expuestas.

Propuesta: crear una nota de operación `docs/ops/purga-env-git.md` con
- los comandos exactos de purga (git filter-repo / filter-branch) para que los corras localmente,
- la lista de llaves a rotar y en qué orden,
- la verificación posterior (que el archivo ya no aparezca listado en el repositorio).

## Ítems que afectan cero filas (recomiendo no ejecutar)

- **RG1c / RG3a — migraciones de datos de membresías.** Consulté la tabla de membresías: no existe ninguna fila con rol `super_admin` ni con el rol antiguo `viewer`, así que ambas migraciones correrían sobre 0 registros. Si de todos modos las quieres como red de seguridad, las agrego idempotentes (seguras de re-ejecutar) y sin efecto en los datos actuales.

## Detalles técnicos

- La verificación se hizo con lectura directa de `organization_members` (agrupado por rol) y búsquedas en `src/lib/contexts/organization/useSuperAdminOrgs.ts`, `src/features/admin/services/organization/index.ts`, `supabase/functions/e2e-provision-users/emailAllowlist.ts` y los constructores de filas de facturación.
- No se requieren migraciones nuevas para cerrar la ola; la última (RG10–RG13, RG16, RG22) ya está aplicada.
- Al implementar, se registra el cambio en `CHANGELOG.md` y se sube `APP_VERSION`.
