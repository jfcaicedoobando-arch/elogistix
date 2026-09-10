# Cancelación de REP: anular el pago sin perder su historia

## Qué encontré primero

- La revisión automática ante el SAT **ya existe** y corre cada 30 minutos (no hace falta un proceso diario nuevo). Toma los REP en "pendiente" o "en verificación" y los cierra cuando el SAT responde.
- La actualización manual del estatus de un REP **también existe**, pero hoy sólo está conectada dentro del asistente de refacturación. En la pestaña de pagos de la factura no hay botón.
- El problema real: el saldo y el estado de la factura suman **todos** los pagos, sin importar que su complemento (REP) ya esté cancelado. Hoy hay **21 facturas en USD marcadas como "Pagada"** cuyo único pago tiene el REP cancelado.

## Cómo lo manejan otros ERPs (y qué haremos)

Un pago ya timbrado no se edita ni se borra: se **anula**. El renglón se conserva con su UUID, fecha y motivo de cancelación como evidencia fiscal, y deja de contar para el saldo. Si el dinero sí entró, se captura un **pago nuevo** con **REP nuevo**. Editar el pago rompería la correspondencia con el CFDI ya timbrado ante el SAT.

## Qué se va a hacer

1. **El pago con REP cancelado deja de contar.** Saldo, estado de la factura, cartera, antigüedad de saldos, portal del cliente y totales de dirección dejan de sumar pagos cuyo REP fue cancelado. El renglón sigue visible, marcado como "Anulado", con importe atenuado y su UUID/fecha de cancelación.

2. **Recálculo automático.** Al confirmarse la cancelación (por la revisión automática, por el webhook o por el botón manual), la factura vuelve sola a "Emitida" o "Vencida" según su vencimiento, y queda registro en bitácora.

3. **Comisiones.** La comisión ligada a ese pago se revierte igual que hoy con un pago eliminado: se cancela si no estaba liquidada, y queda "Por recuperar" si ya se había liquidado.

4. **Botón de actualización manual en la factura.** En la pestaña de pagos, cada pago con REP timbrado o en verificación tendrá "Actualizar estado ante el SAT", reutilizando la función que ya existe. También se agrega en la bandeja de REP pendientes.

5. **Corrección de las 21 facturas afectadas.** Se recalcula su estado y saldo. No se toca ningún pago, factura timbrada ni comprobante: sólo se corrige el estado que quedó mal calculado.

6. **Ya no hace falta borrar el pago.** La acción de eliminar se mantiene sólo para pagos sin REP; para pagos timbrados el camino correcto es cancelar el REP (que ya lo anula) y capturar uno nuevo si aplica.

## Detalles técnicos

- SQL (una migración): filtrar por `estado_rep <> 'Cancelado'` en `saldo_factura`, `recalcular_estado_factura`, `cartera_pendiente`, `cxc_aging_clientes`, `direccion_totales` y `portal_factura_resumen_saldo`. Todas mantienen su firma, `SECURITY DEFINER`, `search_path` y grants actuales, y se espejan en `supabase/schema/` en el mismo cambio.
- Nuevo trigger en `pagos_factura` para `UPDATE OF estado_rep`: dispara `recalcular_estado_factura` y `calcular_comision_pago` (idempotentes) cuando el pago pasa a REP cancelado, con el flag `app.recalc_estado_factura` que ya usa el guard de estado.
- `calcular_comision_pago`: tratar `estado_rep = 'Cancelado'` con la misma rama que hoy usa para `deleted_at IS NOT NULL` (Cancelada / Por recuperar).
- Frontend, sólo presentación y acción existente: `FacturaPagosTabla.tsx` y `FacturaPagosMobileCard.tsx` para el badge "Anulado" y el botón de actualizar (vía `useConsultarRep`, sin nuevo servicio); `bandejaRepColumns.tsx` para la misma acción en la bandeja.
- Corrección histórica con `run_sql`: `UPDATE facturas SET updated_at = now()` sobre los 21 ids para disparar el recálculo, verificando antes y después con consulta de control. Sin borrados ni cambios en pagos.
- Pruebas focalizadas: exclusión de pagos con REP cancelado en saldo/estado, reversión de comisión, y render del badge/acción. Typecheck y ESLint focalizados; CI, RLS y E2E completos quedan para GitHub Actions.
- Cierre obligatorio: `bun run db:postcheck` verde con baseline regenerada, `CHANGELOG.md` y bump de `APP_VERSION`.
