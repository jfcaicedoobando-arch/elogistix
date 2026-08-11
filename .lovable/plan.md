# Por qué no encuentras FP-000042 (y cómo desatorar el documento del buzón)

## Qué encontré en los datos

FP-000042 **sí existe**, pero está **Cancelada** (se canceló el 06/08/2026, motivo "Factura cancelada"). Es la factura del CFDI `FF8288F0-…07A2E`, folio del proveedor `CON-B-16531`, USD 179.80, del embarque ELIMP00302.

Además hay 4 capturas más del mismo CFDI (FP-000043 a FP-000046) que ya fueron **borradas** (papelera). Sólo quedan vivas la cancelada (FP-000042) y nada más.

Analogía: la factura es como un expediente archivado en la caja de "cancelados". El buscador de Cuentas por Pagar sólo revisa el archivero activo, así que por más que escribas "0042" no la ve.

## Los dos problemas reales

1. **La lista de CxP nunca muestra canceladas.** La consulta al servidor excluye siempre `Cancelada`, aunque el filtro de estatus del panel ofrece "Cancelada" como opción. Es decir: existe el filtro, pero elegirlo devuelve cero filas. Eso es lo que te dejó buscando algo que sí está en la base.

2. **El documento del buzón quedó atorado.** El buzón dice "CFDI ya capturado · FP-000042" porque la búsqueda por UUID fiscal ignora si la factura está cancelada. Pero el documento sigue en estado "por capturar", y al intentar capturarlo la validación lo bloquea como duplicado. Resultado: no se puede capturar ni cerrar. El candado de la base (índice único por UUID vivo) tampoco distingue canceladas, así que capturar de nuevo el mismo CFDI fallaría incluso sin la validación de la app.

## Qué haría

### 1. Ver las canceladas en Cuentas por Pagar
- La consulta deja de excluir canceladas siempre: sólo las oculta cuando el filtro de estatus está en "todos" (comportamiento actual por defecto) y las incluye cuando eliges explícitamente "Cancelada" o buscas por folio.
- Al buscar por texto (folio interno, folio del proveedor o proveedor), las canceladas **sí** aparecen, con su badge gris, para que "0042" siempre encuentre algo.

### 2. Mensaje honesto en el buzón
- Cuando el CFDI coincide con una factura **cancelada**, el aviso deja de decir "CFDI ya capturado" y pasa a decir algo como: "Este CFDI se capturó antes en FP-000042, que fue cancelada. Marca el documento como retirado o consulta la factura cancelada."
- El botón para abrir la factura referenciada sigue disponible (te lleva al detalle de FP-000042 con su banner de cancelación).

### 3. Desatorar el documento
- Con el aviso corregido, el documento se puede **retirar** del buzón desde el menú de la fila (ya existe esa acción), y el buzón deja de contarlo como pendiente de 4 días.
- Si además necesitas recapturar el CFDI porque la cancelación fue un error, lo correcto es reactivar/recapturar sobre una factura nueva; eso requiere ajustar el candado de la base para que el UUID único ignore las canceladas. **Lo dejo fuera de esta entrega** salvo que me confirmes que quieres poder recapturar CFDIs cuya factura previa fue cancelada, porque toca integridad fiscal.

### 4. Sin cambios de datos
No voy a modificar ni "descancelar" la factura de la base. Si lo que quieres es que FP-000042 vuelva a estar vigente, dime y lo tratamos aparte con su registro en bitácora.

## Detalles técnicos

- `src/features/cxp/services/proveedorFacturas.ts` → `fetchFacturasCxP`: quitar el `.neq("estado", "Cancelada")` incondicional y condicionarlo a `filtros.estatus` / `filtros.search`.
- `src/features/cxp/services/proveedorFacturas.helpers.ts`: `clasificar` ya devuelve `"Cancelada"`, así que el filtro cliente por estatus funciona sin cambios.
- Buzón: la búsqueda por UUID (`buscarFacturaPorUuidFiscalResultado`) ya devuelve `estado`; usarlo en `FacturaEntranteRow.parts.tsx` / `FacturasEntrantesLista.tsx` y en `pendientesDeCaptura` (`cfdiDuplicado`) para diferenciar "duplicado vivo" de "duplicado cancelado".
- Tests: casos nuevos en los tests de `proveedorFacturas` (canceladas visibles al filtrar/buscar) y del buzón (mensaje de cancelada, no bloquea retirar).
- Cierre: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
