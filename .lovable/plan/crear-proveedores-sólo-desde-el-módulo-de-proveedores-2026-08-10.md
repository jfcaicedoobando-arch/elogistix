# Crear proveedores sólo desde el módulo de Proveedores

Hoy, al capturar una factura de proveedor (XML CFDI o PDF con IA), si el emisor no existe en el catálogo, el modal abre un mini-formulario ("Crear proveedor desde CFDI") que crea el proveedor con datos mínimos y por defecto (tipo "Agente de Carga", país México, moneda MXN). Eso genera altas incompletas fuera del flujo oficial.

## Qué cambia

- El modal de captura **ya no crea proveedores**. En su lugar muestra un aviso claro:
  - "No encontramos a este proveedor en tu catálogo" + RFC/Tax ID y nombre detectados en el documento.
  - Botón "Dar de alta en Proveedores" que abre el módulo de Proveedores en una pestaña nueva, con el alta prellenada (RFC y razón social detectados), para no perder la captura en curso.
  - Nota de que al terminar el alta se puede volver al modal y seleccionar el proveedor en el combo (se refresca el catálogo al volver a enfocar la ventana).
- El proveedor sigue siendo obligatorio para guardar: el hint de pendientes ya indica "Falta el proveedor".
- El mini-diálogo `CrearProveedorDesdeCfdiDialog` se elimina del flujo de captura.

## Detalle técnico

- `src/features/cxp/components/DialogNuevaFacturaProveedor.tsx`: quitar el render de `CrearProveedorDesdeCfdiDialog`.
- Nuevo `src/features/cxp/components/ProveedorNoEncontradoAlert.tsx`: aviso (tono warning, tokens del design system) con RFC/nombre detectados y botón que abre `/compras/proveedores?nuevo=1&rfc=...&nombre=...` en pestaña nueva. Se renderiza dentro de `BandaOrigenYAlertas` (`DialogNuevaFacturaProveedor.columnas.tsx`) usando el estado existente `ctl.askCrearProv`.
- `src/features/proveedor/routes/Proveedores.tsx`: leer `nuevo`, `rfc`, `nombre` de la URL para abrir `NuevoProveedorDialog` con esos valores prellenados y limpiar los parámetros al cerrar.
- Borrar `src/features/cxp/components/CrearProveedorDesdeCfdiDialog.tsx` y ajustar/eliminar sus pruebas asociadas; el estado `askCrearProv` se conserva (ahora sólo alimenta el aviso).
- Se mantiene la lógica de detección por Tax ID / alias / nombre (`useNuevaFacturaProveedorForm.cfdi.ts` y `.pdfIa.ts`) sin cambios.

## Verificación

- Pruebas existentes de `useNuevaFacturaProveedorForm` siguen validando que se dispara `askCrearProv`.
- Nueva prueba de UI: con `askCrearProv` presente, el modal muestra el aviso y el enlace a Proveedores, y no existe ningún botón "Crear proveedor" dentro del modal.
- Actualizar `CHANGELOG.md` y subir `APP_VERSION`.
