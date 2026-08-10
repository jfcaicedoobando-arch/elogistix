# Aprobación de factura FP-000103: no es un bug, es la regla de segregación de funciones

## Qué pasó (verificado en la base de datos)

- La factura `FP-000103` (USD 62.00, estado de aprobación `pendiente`) tiene `created_by = f23da7a7-...`, que es la misma usuaria Karol que intentó aprobarla.
- La función `aprobar_factura_proveedor` bloquea que quien captura apruebe su propia factura, salvo roles administradores (`admin`, `admin_org`, `super_admin`). Karol es `contador`, así que la regla aplica y devuelve `LC_SOD_VIOLATION`.
- En la organización Elogistix sí hay quién puede aprobarla: 2 usuarios `admin_org` y otra usuaria `contador` (distinta de Karol).

Analogía: es como firmar tu propio cheque — el sistema exige que otra persona sea la que autoriza lo que tú capturaste.

## El problema real es de experiencia de usuario

Hoy el botón "Aprobar factura" se muestra habilitado según el rol y el bloqueo aparece **después** del clic, como un error rojo. Eso hace que parezca una falla del sistema.

## Qué haremos

1. **Saber quién capturó la factura en el frontend**: agregar `created_by` (y el nombre de quien capturó, si está disponible) al lector de facturas de proveedor.
2. **Bloqueo preventivo en el detalle de la factura**: si el usuario actual capturó la factura y no es administrador, los botones "Aprobar factura" / "Rechazar" se muestran deshabilitados con un tooltip claro: "Tú capturaste esta factura; debe aprobarla otra persona (segregación de funciones)".
3. **Mismo comportamiento en la bandeja "Por aprobar"** y en la aprobación en lote: las facturas propias no se pueden seleccionar para aprobar, con la misma explicación, para evitar errores parciales en lote.
4. **Mensaje amable si el error igual ocurre** (por ejemplo, dos pestañas abiertas): el mensaje explicará quién puede aprobar en su organización, en lugar de solo decir "no puedes".
5. **Rechazar sí queda permitido** para quien capturó, tal como está hoy en la base de datos (la regla solo cubre la aprobación).

No se cambia la regla de negocio: la segregación de funciones se mantiene.

## Detalles técnicos

- `src/features/cxp/services/proveedorFacturas.ts`: añadir `created_by` al `PROVEEDOR_FACTURAS_SELECT`, al tipo `FacturaCxP` y al mapeo.
- `src/features/cxp/permissions.ts`: nueva función pura `puedeAprobarEstaFactura({ role, userId, createdBy })` con pruebas unitarias.
- `src/features/cxp/components/DialogDetallePagosProveedor.actionbar.tsx`: usar la nueva función para `disabled` + tooltip.
- `src/features/compras/routes/ComprasPorAprobar.tsx` y `useAprobarFacturasLote`: excluir de la selección las facturas capturadas por el usuario actual (no administrador).
- `src/features/cxp/services/aprobacionFactura.ts`: enriquecer el mensaje de `LC_SOD_VIOLATION`.
- Se respeta el límite de 200 líneas por archivo (Power of 10); si algún archivo lo excede, se divide.
- Registrar en `CHANGELOG.md` y subir `APP_VERSION` (patch).

## Fuera de alcance

No se toca la RPC de base de datos ni la matriz de roles.
