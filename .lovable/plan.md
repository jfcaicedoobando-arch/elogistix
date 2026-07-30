## Qué pasó (diagnóstico verificado)

Karol intentó capturar una factura de proveedor cuyo CFDI **ya estaba registrado** en Elogistix. La base de datos hizo bien su trabajo: existe un índice único por organización sobre el UUID fiscal (ignorando facturas borradas), y rechazó el alta.

Lo confirmé en datos: hay UUIDs con varios intentos de captura, donde sólo queda una factura viva y el resto están borradas. Ejemplos reales:

- `ADMINISTRACION GONG`, folio 9593 → 2 intentos borrados + 1 viva (Pagada).
- `WAN HAI LINES`, folio CON-B-16531 → 5 intentos borrados + 1 viva (aprobada).

Es decir: **no es un bug de datos, es un problema de experiencia de uso.** Analogía: el sistema deja que llenes todo el formulario de inscripción y hasta el final te dice "ya estabas inscrito", sin decirte con qué número ni dónde verlo.

## Problemas concretos a corregir

1. La validación previa de duplicados (`existeFacturaDuplicada`) sólo compara **proveedor + folio + fecha de emisión**. No revisa el UUID fiscal, que es el identificador único real del CFDI. Por eso el choque aparece hasta el `INSERT`.
2. El aviso de error dice sólo "Ya existe una factura con este UUID fiscal (CFDI duplicado)" — sin folio interno, sin estado, sin manera de abrir la factura existente.
3. Como el usuario no sabe qué pasó, reintenta: eso explica los 5 intentos borrados del mismo CFDI.

## Plan

### 1. Validar el UUID justo al cargar el XML
- Nuevo servicio `buscarFacturaPorUuidFiscal(uuid)` en `src/features/cxp/services/proveedorFacturas.crud.ts`: busca facturas vivas (`deleted_at IS NULL`) de la organización y devuelve `id`, `folio_interno`, `folio_proveedor`, `proveedor_nombre`, `estado`, `estado_aprobacion`.
- En el flujo de parseo del CFDI (`useNuevaFacturaProveedorForm.ts` + `CargaCfdiSection.tsx`), en cuanto se lee el UUID del XML se hace la consulta y, si ya existe, se muestra una alerta **dentro del modal**: "Este CFDI ya está capturado como FP-000123 (Vigente, aprobada)" con un botón "Ver factura" que abre el detalle, y se deshabilita el botón Guardar.

### 2. Mejorar el aviso de error de respaldo
- En `useNuevaFacturaProveedorForm.submit.ts`, cuando el `INSERT` falle con duplicado de `uuid_fiscal`, consultar la factura existente y mostrar su folio interno y estado en la descripción del toast, en vez del mensaje genérico.

### 3. Extender la validación previa
- Antes de insertar, `runSubmit` verificará también por UUID (no sólo folio+fecha), para cortar el reintento antes de tocar la base.

### 4. Pruebas
- Unitarias del nuevo servicio (encuentra viva, ignora borradas, aísla por organización).
- Unitarias de `handleSubmitError` con el nuevo mensaje enriquecido.
- Prueba del hook: cargar un XML con UUID ya existente bloquea el guardado.

### 5. Cierre
- Bump de `APP_VERSION` a `13.343.0` y entrada en `CHANGELOG.md`.

## Notas técnicas

- Índice existente: `ux_proveedor_facturas_uuid_fiscal_org` sobre `(organization_id, uuid_fiscal)` con `WHERE uuid_fiscal IS NOT NULL AND deleted_at IS NULL`. **No se modifica** — es la protección correcta.
- No se requiere migración de base de datos; todo el cambio es de frontend/servicios.
- No se borran ni fusionan las facturas duplicadas históricas: las repetidas ya están marcadas como borradas y sólo queda una viva por UUID.
