# Permisos por rol en el asistente de refacturación

## Situación actual (verificada)

- La base de datos **ya bloquea** las operaciones del caso: todas las RPCs (`abrir_caso_refacturacion`, `duplicar_factura_para_refacturacion`, `reasignar_pago_factura`, `cerrar_caso_refacturacion`) llaman a `public._assert_refacturador`, que sólo deja pasar a `super_admin`, `admin_org`, `admin` y `contador`, y si no lanza `LC_REFACT_FORBIDDEN`.
- La **interfaz no valida nada**: en `FacturaDetalleActionsBar.tsx` la opción "Refacturar a otro receptor" se muestra a cualquier usuario que pueda sustituir CFDI, y los botones de cada paso del asistente (cancelar REP, crear borrador, cancelar original, reasignar pago, cerrar caso) están siempre habilitados. El usuario sin permiso llega hasta el final y recibe un error del servidor.

Resultado: la seguridad está, pero la experiencia es mala y la intención de permisos no es visible.

## Qué se va a construir

1. **Una sola fuente de verdad de permisos** para refacturación, espejo exacto de la regla de la base: administradores de la organización (`admin`, `admin_org`, `super_admin`) y `contador`.
2. **La opción del menú desaparece** para quien no tiene el permiso, en lugar de dejarlo entrar y fallar.
3. **Cada etapa del asistente exige el permiso**: los botones de acción de los 5 pasos quedan deshabilitados y el pie del modal explica en español por qué ("Tu rol no puede operar casos de refacturación; se requiere contador o administrador").
4. **Modo consulta**: quien no puede operar pero sí ve facturación (por ejemplo `tesorero` o `auxiliar_contable`) puede seguir consultando la trazabilidad del caso ya existente en el detalle de la factura, sin poder confirmar pasos.
5. **Aviso de rol al abrir** el asistente cuando el usuario está en modo consulta, para que sepa a quién pedirle la operación.

## Detalles técnicos

- Nuevo `OPERAR_REFACTURACION` en `src/lib/access/permissionMatrix.finanzas.ts` con `["super_admin","admin_org","admin","contador"]`, re-exportado desde `permissionMatrix.ts` (mismo patrón que `APROBAR_FACTURA_PROVEEDOR`).
- Nuevo helper puro `src/features/facturacion/domain/refacturacionPermisos.ts`: `puedeOperarRefacturacion(role)` y `motivoBloqueoRefacturacion(role)` (devuelve `null` o el texto para el usuario), siguiendo el patrón de `src/features/cxp/permissions.ts`.
- `refacturacionPasos.ts`: `ContextoPasos` recibe `bloqueoPermiso?: string | null`; si viene, `bloqueoPaso` lo devuelve antes que cualquier otra validación (aplica a los 5 pasos).
- `useRefacturarWizard.ts`: lee el rol efectivo con `usePermissions`, calcula `bloqueoPermiso`, lo pasa al contexto y expone `puedeOperar` para que los pasos deshabiliten sus botones (cancelar REP, crear borrador, cancelar original, reasignar/cerrar).
- `RefacturarPasoActual.tsx` y los cinco componentes `Paso*.tsx` reciben `puedeOperar` y deshabilitan sus botones de acción; `DialogRefacturarReceptor.tsx` muestra el aviso de sólo consulta.
- `FacturaDetalleActionsBar.tsx`: la opción "Refacturar a otro receptor" se agrega sólo si `puedeOperarRefacturacion(role)`.
- Pruebas nuevas en `src/features/facturacion/domain/__tests__/refacturacionPermisos.test.ts`: roles permitidos y denegados, y que `bloqueoPaso` gane por permiso en cada uno de los 5 pasos.
- No se toca la base de datos: la regla ya existe y este trabajo la refleja en la interfaz.
- Se sube `APP_VERSION` y se registra la entrada en `CHANGELOG.md`.
