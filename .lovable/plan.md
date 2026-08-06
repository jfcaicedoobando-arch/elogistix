# Tipo de cambio del pago a proveedor: usar el DOF de la fecha de pago

## Situación actual (verificada)

En el modal "Registrar pago a proveedor" el campo **Tipo de cambio** se precarga con `factura.tipo_cambio_usd` (el TC que traía la factura del proveedor), vía `valoresInicialesCreacion` en `usePagoProveedorForm.editar.ts`. No hay ninguna consulta al DOF en ese flujo. Al editar un pago se precarga el TC guardado en el pago.

El historial DOF ya existe en la tabla `tipos_cambio_dof` (alimentada por el cron diario `tc-dof-diario`) y se consulta hoy con `fetchHistorialTcDof` / `useTcInicial`, pero ese hook solo devuelve el último día publicado, no un día específico.

## Qué se va a construir

1. **Consulta de TC por fecha**: nuevo servicio y hook que devuelven el TC DOF de una fecha dada; si ese día no existe (fin de semana, día no publicado), devuelven el último publicado anterior a esa fecha, indicando qué fecha se usó.

2. **Precarga en el modal de pago**:
   - Al abrir el modal y cada vez que cambia la **fecha de pago**, el campo Tipo de cambio se llena con el TC DOF de esa fecha.
   - El campo sigue siendo **editable** (el contador puede sobreescribirlo con el TC real de su banco).
   - Si el usuario ya lo editó a mano, un cambio posterior de fecha no le borra su valor sin avisar: se muestra el TC DOF sugerido con un botón para aplicarlo.
   - Texto de ayuda debajo del campo: "DOF del 06/08/2026: 18.4231" o "DOF del 05/08/2026 (último publicado)".
   - Si no hay DOF disponible, se mantiene el comportamiento actual (TC de la factura como respaldo) y se indica el origen.

3. **Diferencia cambiaria**: cuando la factura es en USD/EUR y el pago va en MXN, se sugiere automáticamente la diferencia cambiaria como `monto en moneda de la factura × (TC del pago − TC de la factura)`, redondeada a 2 decimales, en el campo ya existente. Queda editable y no se recalcula encima si el usuario lo capturó a mano.

4. **Edición de pagos**: al editar un pago existente se conserva su TC original; si el usuario cambia la fecha de pago, se ofrece el TC DOF de la nueva fecha con el mismo botón "Usar DOF".

5. **Pago en lote**: mismo criterio de precarga por fecha en el diálogo de pago en lote, para no dejar dos comportamientos distintos.

## Detalles técnicos

- Nuevo servicio `fetchTcDofPorFecha(fecha)` en `src/features/catalogos/services/tipoCambioDof.ts`: `tipos_cambio_dof` filtrado con `fecha <= <fecha>`, orden descendente, `limit 1`. Devuelve `{ usdMxn, eurMxn, fecha, exacto }`.
- Nuevo hook `useTcDofPorFecha(fecha, enabled)` en `src/features/catalogos/hooks/`, con `queryKey` derivada de `tcDofKeys` y `staleTime` de 15 min (el DOF de un día pasado no cambia).
- `usePagoProveedorForm.estado.ts` / `usePagoProveedorForm.ts`: bandera interna `tcTocadoPorUsuario`; efecto de precarga que solo escribe `tc` mientras la bandera esté en falso.
- Cálculo de diferencia cambiaria en función pura nueva (por ejemplo `sugerirDiferenciaCambiaria`) en `src/features/cxp/services/`, con pruebas unitarias.
- Cambios de UI acotados a `PagoProveedorFormBody.tsx` (texto de origen del TC + botón "Usar DOF"), respetando tokens y `FormDialogShell`.
- Se respetan los límites de 200 líneas por archivo; la lógica nueva vive en módulos aparte.
- Sin cambios de base de datos.

## Verificación

- Pruebas unitarias: `fetchTcDofPorFecha` (día exacto, fin de semana, sin datos), precarga por cambio de fecha, respeto del valor editado a mano y sugerencia de diferencia cambiaria.
- Ejecutar la suite de tests existente de `usePagoProveedorForm` y las validaciones de pago.
- Registro en `CHANGELOG.md` + bump de `APP_VERSION`.
