# Pendientes del flujo fiscal (post 13.137.2)

Las 6 fases del plan original están cerradas (ver `docs/flujo-facturacion.md`). Lo que **no** se hizo y queda como trabajo posterior, agrupado por prioridad.

## Alta prioridad (afecta operación diaria)

1. **Descarga de PDF y XML del CFDI**
   - Hoy guardamos `uuid_fiscal` y `facturapi_id` pero no exponemos el PDF/XML al usuario.
   - Falta: endpoint `facturapi-descargar` (PDF/XML) + botones en `FacturaDetalle` y en el listado.

2. **Envío del CFDI por email al cliente**
   - FacturApi tiene `customer.email` y `send_by_email`. No lo estamos usando.
   - Falta: opción en `DialogTimbrarFactura` ("Enviar al cliente") + botón "Reenviar CFDI" en `FacturaDetalle`. También reenvío del REP.

3. **Notas de crédito (CFDI tipo E) timbradas por FacturApi**
   - La tabla `factura_notas_credito` existe, pero el alta es manual; no se timbra.
   - Falta: RPC + diálogo + edge function `facturapi-emitir-nc` y enlace al CFDI padre.

4. **Cancelación con sustitución (motivo SAT 01)**
   - `DialogCancelarFactura` soporta motivos 02/03/04. El 01 exige folio fiscal de reemplazo, que aún no se captura ni se valida.

## Media prioridad (robustez)

5. **Reintento manual de REP fallido**
   - `useTimbrarRep` ya existe; falta UI: en `PagoFacturaRow` si el pago es PPD y `rep_uuid` está vacío, mostrar botón "Timbrar REP".

6. **Cancelar REP**
   - Hay edge function `facturapi-cancelar-rep` deployada pero sin diálogo ni botón en `DialogHistorialPagos`.

7. **Webhook FacturApi → sincronización**
   - El handler ya actualiza estado de facturas. Falta:
     - Cubrir eventos de REP (`receipt.*`/`payment.*`).
     - Guía en UI para registrar la URL del webhook (`?org=<UUID>`) — hoy hay que sacarlo a mano.

8. **KPIs del módulo de facturación**
   - Mencionados en Fase 6 pero nunca dibujados: "Proformas convertibles", "Facturas sin timbrar", "REPs pendientes".

## Baja prioridad (limpieza)

9. **Deprecar flujo manual `DialogMarcarFacturada`**
   - Sigue activo para datos históricos. Definir fecha de corte y ocultarlo para proformas nuevas.

10. **Migración de facturas históricas a CFDI**
    - Decidir si las facturas previas a 13.137.0 se pueden re-timbrar o quedan como "no fiscales".

11. **Pruebas E2E del flujo completo**
    - Hoy hay tests unitarios de `pagos`/`convertirAFactura`. Falta un happy-path E2E (proforma→factura→timbrado sandbox→pago PPD→REP).

## Sugerencia de orden de ataque

Si quieres avanzar por valor para el usuario: **1 → 2 → 5 → 6 → 3 → 4 → 7 → 8 → resto**.

Dime cuáles activamos y armo el plan de implementación detallado del bloque que elijas.
