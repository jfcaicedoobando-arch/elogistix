# Revisión del parche `fixes_r2_02_frontend-2.diff`

La mayor parte ya está en el proyecto (con nombres propios, no los del parche): topes de importación (2 MB / 1000 filas), margen por moneda en el wizard, margen "n/a" sin venta, IVA por tasa resuelta en proformas, portal sin `notas` y con filtro de papelera, fecha del PDF en zona horaria de negocio, mensajes de cancelación de embarque y envío de cotizaciones MXN-only.

Quedan cuatro cosas que sí valen la pena, ordenadas por valor.

## 1. Bloqueo optimista donde falta (alto valor)

Hoy sólo clientes y embarques avisan si otro usuario editó el mismo registro. Falta en:

- Edición de cotización (wizard completo)
- Notas de crédito (cambios de estado/edición)
- Datos fiscales de timbrado de una factura

Analogía: es como dos cajeros escribiendo en la misma libreta; hoy el último gana en silencio y el trabajo del otro desaparece. Con el candado, el segundo recibe "Este registro fue modificado por otro usuario, recarga la página".

Se reutiliza el helper de conflicto ya existente (`conflictoConcurrenciaError` / `LC_CONFLICTO_CONCURRENCIA`): el `updated_at` leído al abrir el formulario viaja en el UPDATE y, si no coincide, no se aplica nada.

## 2. Anti "fórmula de Excel" en importación CSV (seguridad barata)

Un valor de CSV que empieza con `=`, `+`, `-` o `@` se ejecuta como fórmula si el dato se vuelve a exportar y abrir en Excel. Se añade una sanitización compartida (prefijo `'`) aplicada al valor crudo antes de validar, en los esquemas de clientes y proveedores, con pruebas.

## 3. Importación masiva por lotes reales (rendimiento)

Hoy 1000 filas = 1000 peticiones (agrupadas, pero una por fila). Se cambia a un `insert` con arreglo de hasta 200 filas por petición: 1000 filas pasan de 1000 a 5 viajes al servidor. Si un lote falla, el mensaje dice cuántos registros ya quedaron guardados, para que el usuario sepa dónde va.

## 4. Orden de subida del MSDS al crear cotización (limpieza)

Al crear, primero se sube el PDF de MSDS y luego se inserta la cotización: si la inserción falla, el archivo queda huérfano en el almacenamiento. Se invierte el orden en el alta (en la edición se queda igual, porque ahí ya existe el registro).

## Detalles técnicos

- `src/features/cotizacion/services/mutations/update.ts`, `hooks/mutations/useCotizacionMutations.ts`, `routes/EditarCotizacion.tsx`: parámetro opcional `expectedUpdatedAt`, `.eq("updated_at", expected)` y `select` para detectar 0 filas.
- `src/features/facturacion/services/notasCredito.ts` y `datosFiscalesCliente.ts`: mismo patrón; en NC se conserva además el guard por `estado`.
- Nuevo `src/lib/csv/importSchemasShared.ts` con `sanitizeCsvFormula` + `sanitizeRow`, usado por `importSchemaCliente.ts` e `importSchemaProveedor.ts`.
- `createClientesLote` en `src/features/cliente/services/crud.ts` e `insertProveedoresLote` en `src/features/proveedor/services/proveedoresCrud.ts` (lote 200, reexportados en los `index.ts`), consumidos por `Clientes.tsx` y `ProveedoresImportDialog.tsx`.
- `src/features/cotizacion/services/wizard.ts`: mover `subirMsds` después del insert en el alta.
- Sin cambios de base de datos. Pruebas unitarias nuevas para conflicto de concurrencia, sanitización CSV y lotes; `CHANGELOG.md` + `APP_VERSION` a 13.760.0.
