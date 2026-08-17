# Patch 1 — Blockers de seguridad (revisado contra el código actual)

Revisé los 6 fixes del parche contra el estado real del repo y de la base de datos. Cuatro aplican tal cual, uno ya está hecho, y uno necesita un ajuste para no romper los montos negativos.

## Qué se va a aplicar

### 1. Fuga de datos entre organizaciones al cerrar sesión (blocker) — SÍ aplica
Hoy `signOut` no limpia el caché de consultas, así que en una pestaña compartida el siguiente usuario puede ver datos del tenant anterior por unos segundos. Se limpia el caché completo al cerrar sesión y también cuando entra un usuario distinto sin haber cerrado sesión antes.

### 2. Vendedor no podía crear cotizaciones (blocker) — YA RESUELTO
La función de permisos en la base ya incluye el rol `vendedor` (verificado en la base productiva). No se creará la migración del parche para no duplicar el cambio. Sí se agregará el archivo de prueba SQL, que aporta cobertura de regresión.

### 3, 4 y 5. Paginación del CRM sin criterio de desempate — SÍ aplica
Leads, actividades y oportunidades ordenan por una sola columna; cuando varios registros comparten la misma fecha (típico en importaciones masivas), al pasar de página se repiten o se pierden filas. Se agrega el `id` como segundo criterio de orden en las tres consultas.

### 6. Fórmulas maliciosas en los CSV exportados — APLICA CON AJUSTE
El parche neutraliza celdas que empiezan con `= + - @` (tab/CR) poniéndoles un apóstrofo. Tal cual, eso convertiría montos negativos (`-1234.50`) en texto `'-1234.50`, rompiendo los reportes contables en Excel. Ajuste: aplicar el apóstrofo salvo cuando el valor sea un número válido, de modo que los negativos sigan siendo numéricos.

## Detalles técnicos

- `src/lib/contexts/AuthContext.tsx`: `useQueryClient()` + `queryClient.clear()` en `signOut` y en un efecto que compara `user.id` previo (ref) contra el actual cuando `lastEvent === "SIGNED_IN"`.
- `src/features/crm/services/leads/queries.ts`, `src/features/crm/services/actividades.ts`, `src/features/crm/services/oportunidades.ts`: `.order("id", ...)` secundario en el mismo sentido, antes del `.range()`.
- `src/generators/exportCsv.ts`: en `escape()`, prefijo `'` si `/^[=+\-@\t\r]/` y el valor NO pasa como numérico finito; luego el entrecomillado existente.
- `supabase/tests/test_puede_escribir_cotizaciones_vendedor.sql`: nuevo test del parche (sin la migración, ya aplicada).
- Pruebas: unitarias nuevas para `exportToCsv` (fórmula neutralizada, negativo intacto) y para la limpieza de caché en `signOut`.
- `CHANGELOG.md` + `APP_VERSION` → `13.631.1`.
