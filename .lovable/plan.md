# Corrección de errores activos en Sentry

Hay 3 issues sin resolver. Esto es lo que encontré al revisarlos contra la base de datos y el código actual.

---

## 1. "function public.generar_expediente(tipo_operacion) does not exist" (JAVASCRIPT-REACT-4K)

Verificado: la función en base de datos hoy sólo existe con firma `(tipo_op text)`, y `avanzar_estado_embarque` ya la llama con `::text`. El error ocurrió el 03/08 a las 21:37 y el arreglo se aplicó a las 21:46 del mismo día, así que ya no se puede reproducir.

Acción: marcar el issue como resuelto en Sentry (sin cambios de código).

---

## 2. "new row violates row-level security policy" al subir archivos (JAVASCRIPT-REACT-4M)

Este sí es un bug real y bloquea trabajo. Analogía: el candado del archivero sólo acepta carpetas con el nombre exacto del expediente; cualquier otra carpeta la rechaza, aunque seas el dueño del archivero.

La política de subida del bucket `documentos` (`can_manage_document_object`) sólo acepta rutas `embarques/{expediente}/…` o `embarques/{id}/{documento_id}/…` **de un embarque que ya exista**. Tres rutas del código no cumplen eso:

| Dónde | Ruta que genera | Por qué falla |
|---|---|---|
| MSDS al crear/editar embarque | `embarques/msds/…` | `msds` no es un expediente |
| MSDS en cotización | `cotizaciones/msds-…` | prefijo no permitido |
| Alta de embarque con documentos | `embarques/{expediente}/…` | los archivos se suben **antes** de crear el embarque, así que el expediente todavía no existe |

Correcciones:

- Migración que amplía la política de INSERT/UPDATE/SELECT/DELETE del bucket para aceptar, además de lo actual, adjuntos "de trabajo" bajo carpeta de organización: `{organization_id}/msds/…` y `{organization_id}/cotizaciones/…`, validando que el usuario pertenezca a esa organización. Mantiene el resto de la validación por expediente intacta.
- Cambiar las rutas de MSDS (embarque y cotización) al nuevo prefijo con `organization_id`.
- En el alta de embarque, invertir el orden: crear primero el embarque y subir los documentos después, o reservar el expediente en la tabla antes de subir. Se elige crear primero el embarque y luego adjuntar, para que la política siempre encuentre la fila.
- Traducir el error de permisos de almacenamiento a español claro y reportarlo como error manejado (hoy sale como promesa no atendida, sin contexto).

## 3. FK al re-sembrar la demo (JAVASCRIPT-REACT-1G)

`seed_demo_organization_core` borra `pagos_proveedor` antes de `proveedor_facturas`, así que el orden es correcto; hoy no existen pagos huérfanos ni con organización distinta. El patrón compatible con el error es que dos ejecuciones simultáneas del botón "Ver demo" se cruzaron: una borró e insertó pagos mientras la otra iba borrando facturas.

Correcciones:

- Agregar un candado de ejecución (`pg_advisory_xact_lock`) al inicio de `seed_demo_organization_core` para que dos re-sembrados nunca corran a la vez.
- Reforzar el borrado: eliminar también los pagos que apunten a facturas de la organización demo (no sólo los que tengan ese `organization_id`).
- En el frontend, evitar disparos repetidos del botón de demo mientras hay uno en curso.

---

## Detalles técnicos

- Migración: nuevas versiones de `public.can_manage_document_object` y de las políticas de `storage.objects` para el bucket `documentos`; nueva versión de `public.seed_demo_organization_core` con advisory lock (`GRANT`/`REVOKE` se conservan tal cual).
- Frontend: `src/features/embarques/hooks/useEmbarqueForm.ts`, `src/features/cotizacion/services/wizard.ts`, `src/lib/storage/index.ts`, `src/features/embarques/hooks/useEmbarqueSubmitOrchestrator.ts`, `src/services/storage/index.ts` (mensaje de permisos en es-MX).
- Tests: unitarios de construcción de rutas y del mapeo de error de permisos; test del orden de fases en el alta de embarque.
- Cierre en Sentry de los 3 issues y registro en `CHANGELOG.md` con bump de `APP_VERSION`.
