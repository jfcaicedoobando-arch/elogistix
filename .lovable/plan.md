# Arreglar CI de las Olas 1–4 del detalle de proveedor

Los logs subidos corresponden al CI de la versión 13.559.x. Nada de esto rompe la app en producción: son las reglas internas de calidad (guardias de arquitectura y de migraciones) que el código nuevo del módulo de proveedor no respetó. Hay 7 fallos, todos concentrados en los archivos que agregamos en las Olas 2–4.

## Qué falló y cómo se corrige

### 1. Notificaciones (2 fallos: `audit:sonner` + test de arquitectura)
`ProveedorDocumentosTab.tsx` y `useProveedorDocumentos.ts` usan `toast` de sonner directo. Se migran a `notifySuccess` / `notifyError` de `@/lib/ui/appFeedback`, pasando el `method` correspondiente para que el error quede trazado igual que en el resto de la app.

### 2. Enlaces dentro de columnas de tabla (1 fallo)
`proveedorMovimientosColumns.tsx` y `proveedorOperacionesColumns.tsx` importan `Link`. La convención del proyecto es que el drill-down de la fila se haga con `getRowHref` en `DataTable`. Se quitan los `Link` inline y se pasa el destino con `getRowHref` en las tablas de operaciones y de estado de cuenta, conservando el mismo comportamiento de clic para el usuario.

### 3. Falta mensaje amigable para `LC_ORG_SIN_CONTEXTO` (1 fallo)
El código de error nuevo que devuelven las RPCs no tiene texto en español. Se agrega a `src/lib/errors/lcCodeMessages.ts` con un mensaje claro (contexto de organización no disponible; volver a seleccionar la organización).

### 4. Validación de datos de la base (1 fallo, `fromDb` sin schema)
El módulo proveedor pasó de 2 a 4 lecturas sin validación en tiempo de ejecución. Se agregan schemas zod para los dos boundaries nuevos (estado de cuenta y movimientos), usando `fromDb(data, schema)`. Es la opción correcta: valida importes y fechas que vienen de las RPCs nuevas, en lugar de solo subir el límite permitido.

### 5. Migración sin `DROP POLICY IF EXISTS` (1 fallo, H4)
La migración de `proveedor_documentos` crea 4 políticas sin el `DROP POLICY IF EXISTS` previo que exige la auditoría. Se agrega una migración correctiva idempotente que recrea las mismas 4 políticas con el patrón obligatorio (sin cambiar los permisos efectivos).

### 6. Umbral de cobertura (1 fallo)
El reporte quedó en 34.26% contra el mínimo de 38%. Parte del faltante viene de que 4 shards abortaron. Se corre la suite tras los arreglos anteriores para medir el número real y, si sigue por debajo, se agregan tests del código nuevo sin tocar el umbral: componentes del tablero de Salud (`ProveedorAlertasCard`, `ProveedorScorecardCards`, `ProveedorComparativoCard`) y los servicios de estado de cuenta que aún no tienen pruebas.

## Detalles técnicos

- Archivos a editar: `ProveedorDocumentosTab.tsx`, `useProveedorDocumentos.ts`, `proveedorMovimientosColumns.tsx`, `proveedorOperacionesColumns.tsx`, las tablas contenedoras (para `getRowHref`), `src/lib/errors/lcCodeMessages.ts`, `src/features/proveedor/services/estadoCuenta.ts` y `estadoCuentaMovimientos.ts` (+ nuevos schemas zod).
- Nueva migración correctiva de políticas RLS de `proveedor_documentos` con `DROP POLICY IF EXISTS` antes de cada `CREATE POLICY`.
- Verificación: `audit:sonner`, `audit:tests`, `audit:migrations` y la suite de tests del módulo proveedor en verde antes de cerrar.
- Se sube `APP_VERSION` a 13.559.2 y se registra la entrada en `CHANGELOG.md`.

## Fuera de alcance

- Los mensajes `[bitacora] getSession is not a function` en los logs son ruido de mocks en tests que sí pasan; no rompen CI. Se pueden limpiar aparte si quieres.
- Títulos de test duplicados en `estadoCuentaRpc.test.ts` se renombran solo si `audit:tests` los sigue marcando tras los arreglos.
