# Abrir proformas por folio (error de Sentry JAVASCRIPT-REACT-6K)

## Qué está pasando

Al abrir `https://librecarga.com/proformas/PRO-2026-0008` la app intenta buscar la proforma como si el folio fuera un identificador interno. La base rechaza el dato y aparece un mensaje rojo de "No pudimos cargar la información · Revisa tu conexión", que además no es cierto: la conexión está bien.

Verificado: la pantalla de detalle busca la proforma únicamente por identificador interno, y todos los enlaces internos de la app usan ese identificador. La dirección con folio sólo falla cuando alguien la escribe o la comparte a mano.

## Qué se va a hacer

1. Reconocer el folio: si lo que viene en la dirección no es un identificador interno, buscar la proforma por su número de folio (por ejemplo `PRO-2026-0008`), siempre dentro de la empresa del usuario.
2. Si el folio no existe, mostrar la pantalla "Proforma no encontrada" con el botón para volver al listado, en lugar del error rojo de conexión.
3. Dejar intactos los enlaces internos, los permisos, el aislamiento por empresa y el resto de la pantalla (conceptos, factura, historial).

## Detalles técnicos

- `src/features/proformas/services/queries.ts` — en `fetchProformaPorId`, detectar formato UUID; si no lo es, filtrar `.eq("numero", ...)` en lugar de `.eq("id", ...)`, conservando `.is("deleted_at", null)` y `maybeSingle()`. Sin cambios en el `select`, en el merge ni en `fromDb`.
- `src/features/proformas/hooks/useProformaDetalle.ts` — sin cambios de contrato; los conceptos ya se piden con `proforma.id` real, así que funcionan igual al llegar por folio.
- Regresión mínima en `src/features/proformas/services/__tests__/` : con UUID filtra por `id`; con `PRO-2026-0008` filtra por `numero`; sin resultado devuelve `null` (pantalla de no encontrada, sin error).
- Se marcará el issue `JAVASCRIPT-REACT-6K` como resuelto y se referenciará en el CHANGELOG con bump de patch (13.823.275).

## Fuera de alcance

- No se cambian rutas ni el router, ni se añaden búsquedas por folio en facturas u otros módulos.
- No hay migraciones, cambios de datos, permisos ni de workflows de CI/RLS.
- `LIFTGO-2` en Sentry pertenece a otra aplicación, no a este proyecto.
- Pruebas completas (CI, RLS, Vitest, E2E) quedan para GitHub Actions; no se publica.
