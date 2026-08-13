# Permitir reasignar el pago mientras el SAT verifica la cancelación del CFDI original

## Tu diagnóstico es correcto

Revisé el caso de la F1026 y el candado que te detiene es **sólo de la pantalla**, no de la base de datos:

- La F1026 está en `Pagada` con la cancelación **solicitada y en trámite** (`pending`).
- El REP del pago **ya quedó cancelado** (tiene fecha de cancelación registrada).
- La nueva factura **F1035 ya está timbrada y vigente** por $95,120.00 MXN, sin pagos aplicados.
- La función de base de datos que mueve el pago (`reasignar_pago_factura`) **no exige** que la factura original esté cancelada: sólo pide REP cancelado, factura destino timbrada, misma moneda y que el pago no exceda el saldo. Lo mismo aplica al cierre del caso.

O sea: el paso 4 está pidiendo esperar algo que ni el SAT ni el sistema necesitan para mover el dinero. Analogía: ya cancelaste el recibo viejo y ya emitiste el nuevo; estás esperando el sello de acuse del correo para pegar el pago en el recibo nuevo, cuando el pago nunca dependió de ese sello.

## Qué voy a cambiar

1. **Paso 4 deja de bloquear cuando ya hay cancelación en trámite.**
   - Si la cancelación **no se ha solicitado** (sin trámite y factura viva) → sigue bloqueando, como hoy.
   - Si está en `pending` / `verifying` → se permite continuar con un **aviso amarillo**: "La cancelación del CFDI original está en verificación con el SAT; puedes reasignar el pago porque el REP anterior ya está cancelado".
   - Si ya está `Cancelada` / `Sustituida` → sin cambios (verde, continuar).
   - Si el SAT **rechaza** la cancelación (`rejected` / `expired`) → se avisa que debe volverse a solicitar.

2. **Paso 5 (reasignar) queda habilitado en ese escenario**, conservando los candados que sí importan: REP cancelado, factura destino timbrada, misma moneda, sin sobrepago y ordenante capturado.

3. **Aviso permanente de seguimiento** en el paso 4/5 con el estatus real del trámite, para que quede claro que el caso no se cierra a ciegas: el sistema seguirá reconciliando la cancelación contra el SAT y la factura original quedará cancelada cuando el SAT responda.

4. **Sin cambios en base de datos.** Los candados fiscales duros (REP vivo, factura destino, moneda, sobrepago, permisos) se quedan tal como están.

## Riesgo y por qué es aceptable

El único riesgo real sería reportar dos veces el mismo depósito ante el SAT, y eso ya se evita con la regla que se mantiene intacta: **el nuevo REP no se puede timbrar mientras exista un REP vivo del pago anterior**. En la F1026 ese REP ya está cancelado, y la factura original quedará cancelada por sí sola en cuanto el SAT libere el trámite. Si el SAT llegara a rechazar la cancelación, el sistema lo detecta y el paso 4 volverá a marcar que hay que volver a solicitarla.

## Detalles técnicos

- `src/features/facturacion/services/refacturacion.ts`: agregar `cancellation_status` al `select` y al tipo `FacturaRefacturacionEstado`.
- `src/features/facturacion/domain/refacturacionPasos.ts`:
  - nuevo helper `cancelacionOriginalEnTramite(factura)` (`pending` / `verifying`);
  - `bloqueoPaso(4)` deja de bloquear en trámite y sigue bloqueando cuando no hay solicitud (o fue rechazada/expirada);
  - `avisoPaso` cubre el aviso de cancelación de la factura original en pasos 4 y 5.
- `src/features/facturacion/components/refacturacion/PasoCancelarOriginal.tsx`: badge y bloque informativo del estado del trámite (`En verificación`, `Rechazada`, `Cancelada`).
- Pruebas: extender `refacturacionPasosRep.test.ts` (o un nuevo `refacturacionPasosOriginal.test.ts`) con los casos sin trámite / en trámite / rechazada / cancelada.
- `CHANGELOG.md` + `APP_VERSION` → `13.594.0`.
