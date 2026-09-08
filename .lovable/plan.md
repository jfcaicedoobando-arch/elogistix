# Plan: cancelar REP desde el detalle de factura

## Contexto
Hoy la cancelación de un REP (Complemento de Pago) solo está disponible dentro del asistente de **Refacturación**. En el detalle de factura se puede ver el REP timbrado en la tabla de pagos, descargarlo y eliminar el pago, pero no hay una acción directa para cancelar el REP ante el SAT. El backend y el hook ya existen (`useCancelarRep`, `cancelarRep`), por lo que el alcance es puramente frontend: exponer esa acción en la tabla de pagos.

## Cambios propuestos

1. **Nuevo diálogo `DialogCancelarRep.tsx`**
   - Reutiliza `FormDialogShell` y el selector de motivos SAT (`MOTIVOS_CANCELACION_SAT`).
   - Muestra folio/UUID del REP, monto y fecha de pago para evitar errores.
   - Usa `useCancelarRep(facturaId)` para enviar la cancelación.
   - Muestra estados de respuesta del SAT: aceptada, en verificación o error.
   - No incluye sustituta (ese caso se sigue manejando en Refacturación).

2. **Modificar `FacturaPagosTabla.tsx`**
   - Agregar prop `onCancelarRep?: (pagoId: string) => void` o manejar el diálogo localmente.
   - En la columna de acciones mostrar botón “Cancelar REP” cuando:
     - Existe `uuid_rep`.
     - `rep_cancelado_en` es null.
     - `rep_cancellation_status` no es `accepted`, `pending` ni `verifying`.
   - Mantener la restricción actual de no eliminar un pago con REP vigente.

3. **Modificar `FacturaPagosMobileCard.tsx`**
   - Agregar la misma acción de cancelar REP en la tarjeta móvil, con las mismas reglas de visibilidad.

4. **Controlador o manejo inline**
   - Crear un pequeño hook/controlador para abrir el diálogo, guardar el `pagoId` seleccionado, validar motivo y ejecutar la mutación.
   - Tras éxito, invalidar queries de factura y bandejas (`queryKeys.facturacion.bandejaRepsHistorico` y la query del detalle).

5. **Regresión**
   - Agregar un test focalizado para `DialogCancelarRep` que valide:
     - Botón cancelar se oculta cuando no hay REP vigente.
     - El motivo por defecto es el primero del catálogo SAT.
     - Al confirmar se llama la mutación con el motivo seleccionado.
   - No ejecutar la suite completa localmente; quedará para GitHub Actions.

6. **Versionado**
   - Bump de `APP_VERSION` en `src/constants/appVersion.ts`.
   - Entrada breve en `CHANGELOG.md` al final del bloque.

## No incluye
- Migraciones ni modificaciones de datos.
- Cambios al flujo de Refacturación.
- Nuevos endpoints ni edge functions (se reutiliza `facturapi-cancelar-rep`).
- Publicación ni ejecución de CI/RLS/Vitest/E2E localmente.
