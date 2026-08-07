# Asesor de rendimiento de base de datos — hallazgos y plan de optimización

Corrí el asesor (consultas más lentas + salud del servidor + linter + estadísticas de acceso). La base está sana en infraestructura, pero el costo de CPU está dominado por la **evaluación repetida de permisos (RLS)**, no por falta de índices en tablas grandes.

## Estado del servidor (sano)

- Base y conexiones OK: 15/60 conexiones, 2/200 clientes del pool, memoria 46%, disco 17%, 0 reinicios.
- Tamaño de base: 818.9 MB. WAL: 272 MB.
- No hace falta subir el tamaño de la instancia: el cuello de botella es lógico, no de capacidad.

## Hallazgo principal: los permisos se evalúan demasiadas veces

Analogía: cada vez que alguien abre una pantalla, el guardia de seguridad no revisa una credencial — revisa cinco credenciales distintas, y lo hace tabla por tabla, en cada consulta.

Números medidos:

- `user_roles` (18 filas) acumula **1,118 millones** de lecturas secuenciales.
- `organization_members` (13 filas) acumula **1,087 millones**.
- Las políticas ya están correctamente envueltas en `(SELECT ...)`, pero una política típica llama `has_role()` **hasta 5 veces** (admin, admin_org, operador, contador, super_admin) y además existen 2–3 políticas permisivas por tabla, que se suman.

## Segundo hallazgo: consultas caras por volumen, no por índices

| Consulta | Llamadas | Media | Total |
| --- | --- | --- | --- |
| `auditoria_revisiones` (listado, 391 filas) | 9,305 | ~30 ms | 311 s |
| `sidebar_alert_counts()` | 11,415 | ~25 ms | 294 s |
| `conceptos_costo` por liquidación (907 filas) | 997 | 159 ms | 159 s |
| `bitacora_actividad` con conteo total | 142 | 586 ms (máx 3.8 s) | 83 s |
| `cartera_pendiente()` | 131 | 322 ms (máx 1.8 s) | 42 s |

Ninguna de esas tablas pasa de unos miles de filas: el tiempo se va en RLS y en el conteo total exacto que pide PostgREST.

## Tercer hallazgo: índices duplicados y llaves foráneas sin índice

- Índices duplicados exactos detectados: `idx_bitacora_org_created` / `idx_bitacora_org_created_at`, `idx_bitacora_entidad` / `idx_bitacora_entidad_id`, `idx_conceptos_costo_embarque` / `idx_conceptos_costo_embarque_id`, `auditoria_revisiones_unq` / `auditoria_revisiones_unique_finding`.
- ~46 llaves foráneas de una sola columna sin índice de soporte (entre ellas `organization_id` en `documentos_embarque`, `eventos_embarque`, `cotizacion_costos`, `contactos_cliente`, `notas_embarque`, `auditoria_comentarios`, y `cuenta_bancaria_id` en `pagos_proveedor`, `anticipos_proveedor`, `pagos_proveedor_lote`).

## Cuarto hallazgo: transacciones abortadas

363 millones de transacciones revertidas y 8 deadlocks desde el último reinicio. Es un número muy alto y merece diagnóstico propio antes de tocar nada: puede ser ruido de reintentos de PostgREST o errores reales en disparadores.

## Plan de trabajo propuesto

### Fase 1 — Colapsar la evaluación de roles (mayor impacto, riesgo medio)

1. Crear `public.current_user_roles()` → `app_role[]`, `STABLE SECURITY DEFINER`, que lea `user_roles` **una sola vez** por consulta.
2. Reescribir las políticas de las tablas más consultadas (`embarques`, `conceptos_costo`, `conceptos_venta`, `facturas`, `proformas`, `documentos_embarque`, `pagos_factura`, `proveedor_facturas`) para usar
   `(SELECT current_user_roles()) && ARRAY['admin','operador',...]::app_role[]`
   en vez de 5 llamadas a `has_role`.
3. Fusionar los pares "Tenant CRUD" + "Tenant viewer" en una sola política de SELECT por tabla, para reducir políticas permisivas evaluadas.
4. `has_role()` se mantiene (lo usan otros lugares y las pruebas), solo deja de ser el camino caliente.

Se hace tabla por tabla, verificando con las suites RLS existentes (`supabase/tests/rls/`) después de cada grupo, para no abrir fugas entre inquilinos.

### Fase 2 — Reducir llamadas desde el frontend

- `auditoria_revisiones`: el listado se pide 9,305 veces sin filtro de organización. Añadir filtro explícito por `organization_id` y `staleTime` mayor en su hook.
- `sidebar_alert_counts()`: ya tiene 30 min de caché; revisar por qué se sigue invocando 11 mil veces (probables remontajes / múltiples pestañas) y compartir una sola consulta.
- `bitacora_actividad`: cambiar el conteo exacto (`count=exact`) por `count=planned` o paginación por cursor; ahí está el máximo de 3.8 s.

### Fase 3 — Higiene de índices (bajo riesgo)

- Eliminar los 4 índices duplicados (menos trabajo en cada escritura, menos espacio).
- Crear índices para las llaves foráneas que participan en filtros y borrados en cascada, empezando por `organization_id` y `cuenta_bancaria_id`. No indexar todas las 46: solo las que aparecen en consultas reales.

### Fase 4 — Diagnóstico de transacciones abortadas

Revisar `pg_stat_database`, logs de funciones y disparadores para identificar el origen de los rollbacks, y reportar antes de proponer cambios.

## Notas técnicas

- Todos los cambios de esquema van por migraciones (`CREATE INDEX` sin `CONCURRENTLY`).
- Después de cada fase: `EXPLAIN (ANALYZE, BUFFERS)` sobre las consultas afectadas y re-corrida de las suites RLS.
- Se registrará en `CHANGELOG.md` con bump de `APP_VERSION`.
- El linter reporta 286 hallazgos, casi todos de seguridad (vista `SECURITY DEFINER`, funciones ejecutables por `anon`). Son de otra categoría; los dejo fuera de este plan salvo que quieras incluirlos.
