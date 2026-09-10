# ELIMP00298: el checklist se ve completo pero el cierre se bloquea por una comisión

## Qué encontré (verificado en la base)

El expediente **ELIMP00298** está en estado *Por liquidar* y todos los puntos operativos, documentales, de costos, facturación y cobranza están realmente completos: 0 documentos faltantes, 0 costos sin factura, 0 facturas del buzón por capturar, 0 conceptos de venta pendientes, 0 contenedores incompletos.

Lo que bloquea el cierre es un punto que **la pantalla no está contando**: una comisión del embarque quedó marcada como *Devengada* con la nota "Sin vendedora asignada al embarque" (creada el 21/07/2026). La validación del cierre la ve como pendiente y responde "no se puede cerrar".

En la pantalla ese punto aparece en gris como "No aplica" porque el cliente **ENTERA SALUD ANIMAL Y NUTRICION** está marcado como *sin comisión*, y la pantalla excluye del conteo los puntos en gris. Resultado: el checklist se ve 100% completo mientras el candado del servidor sigue contando la comisión.

Es decir: hay dos criterios distintos para el mismo punto. La pantalla ya sabe que este embarque no genera comisión; la validación del cierre no.

## Qué voy a hacer

1. **Alinear la validación del cierre con la regla de "sin comisión"**: cuando el embarque no genera comisión (por el cliente o por la excepción propia del embarque), el punto de comisiones deja de bloquear y se reporta como no aplicable, igual que ya lo muestra la pantalla.
2. **Limpiar el registro atorado de ELIMP00298**: recalcular la comisión de ese pago con la regla vigente, con lo que queda como *Cancelada* con la nota "Embarque excluido de comisión". No se borra el registro, no se toca el pago, la factura ni los importes.
3. **Dejar visible el motivo**: el punto de comisiones mostrará "Este embarque está marcado como sin comisión" con su etiqueta correspondiente, y el contero del checklist coincidirá con lo que permite el botón de cerrar.
4. Confirmar después del ajuste que ELIMP00298 sí puede cerrarse, y revisar si hay otros embarques en la misma situación (los reporto, no los toco sin tu visto bueno).

No cambio permisos, importes, IVA, tipos de cambio, comisiones ya liquidadas, ni ninguna otra regla del cierre.

## Detalles técnicos

- `validar_cierre_embarque`: el check `comisiones_definitivas` usa `public.resolver_sin_comision(p_embarque_id)`. Si resuelve `true`, el check emite `ok = true` con `detalle.sin_comision = true` y no entra al `AND` de `puede_cerrar` (tampoco cuenta la cola `comisiones_recalculo_pendiente` de ese embarque). Se actualizan la migración y el espejo en `supabase/schema/`.
- Dato: `PERFORM public.calcular_comision_pago('49997947-c876-475c-92e7-aaf187f6e2bd')` para que la fila `comisiones_devengadas 7e510f4f…` pase a `Cancelada` por la rama `resolver_sin_comision` ya existente; se registra en `bitacora_actividad`. Sin `UPDATE` manual de estados.
- UI: `cierreCheckNoAplica.ts` ya marca las reglas de comisión con `MOTIVO_SIN_COMISION` cuando `sinComision` es efectivo; se ajusta para que ese motivo aplique también con `ok = false` (hoy `marcarRentabilidad` sólo cubre checks en `ok`) y así el gris sea consistente con el nuevo resultado del servidor.
- Pruebas focalizadas: `cierreCheckNoAplica.test.ts` (caso comisión pendiente + sin comisión) y `TabCierre.rules.test.ts`.
- Cierre: `APP_VERSION`, `CHANGELOG.md`, `audit:manifest`, auditoría de espejos SQL y `bun run db:postcheck`. CI, RLS y E2E completos quedan a GitHub Actions.
