# Estado actual de los 11 pendientes fiscales

Revisé el código contra la lista. Esto es lo que **ya está hecho** y lo que **realmente queda pendiente**.

## Ya implementado (no hay que tocar)


| #   | Item                                    | Dónde quedó                                                                                            |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Descarga PDF/XML del CFDI               | `facturapi-descargar` desplegada + botones en `FacturaDetalle` (13.137.8)                              |
| 2   | Envío del CFDI por email                | `facturapi-enviar-email` + checkbox en `DialogTimbrarFactura` + botón "Reenviar" (13.137.8)            |
| 3   | Notas de crédito timbradas              | `facturapi-emitir-nota-credito` + `DialogCrearNotaCredito` + sección en `FacturaDetalle` (13.137.8/10) |
| 4   | Cancelación con sustitución (motivo 01) | `DialogSustituirFactura` + `duplicar_factura_para_sustitucion` (13.137.9)                              |
| 5   | Reintento manual de REP                 | Botón "Timbrar REP" ya está en `PagoFacturaRow.tsx:84`                                                 |
| 6   | Cancelar REP                            | `DialogCancelarRep` integrado en `DialogHistorialPagos`                                                |


## Realmente pendiente

### Media prioridad

**7. Webhook FacturApi — partes faltantes**

- El handler hoy procesa `invoice.status_updated`, `invoice.canceled`, `invoice.delivered_to_recipient`. **Faltan eventos de REP** (`receipt.created`, `receipt.canceled`, `payment.*`) para sincronizar `pagos_factura.rep_*` cuando se timbra desde fuera o asincrónicamente.
- **Falta UI** que muestre al admin la URL exacta del webhook con `?org=<UUID>` ya pre-armada (hoy hay que construirla a mano). Pertenece a `FacturapiCredencialesCard`.

**8. KPIs del módulo de facturación**

- Cero hits para "Proformas convertibles / Facturas sin timbrar / REPs pendientes" en `src/features/facturacion/`. Hay que crear `FacturacionKpis.tsx` con tres tarjetas que cuenten:
  - Proformas en estado `Aprobada` sin `factura_id`
  - Facturas con `estado='Borrador'` y sin `facturapi_id`
  - `pagos_factura` PPD con `rep_uuid IS NULL`

### Baja prioridad (limpieza)

**9. Deprecar `DialogMarcarFacturada**`

- Sigue activo en `TabProformas.tsx`. Decisión + flag para ocultarlo en proformas creadas después de la fecha de corte.

**10. Migración de facturas históricas**

- Decisión de producto: ¿se re-timbra el histórico previo a 13.137.0 o quedan marcadas "no fiscales"? No hay código aún.

**11. E2E del flujo completo**

- Hay tests unitarios pero no un happy-path Playwright: proforma → factura → timbrado sandbox → pago PPD → REP.

## Orden sugerido para retomar

Por valor inmediato al usuario:

```text
7  Webhook REP + UI con URL ──► cierra el ciclo asíncrono
8  KPIs de facturación      ──► visibilidad de pendientes
9  Deprecar marcado manual  ──► limpieza tras 7 y 8
10 Migración histórica       ──► decisión de producto
11 E2E sandbox               ──► red de seguridad antes de prod
```

**Dime cuál activamos** y armo el plan detallado de ese bloque (no toco código todavía).

Vamos a hacer 7,8,9, y 11.  El punto 10 no se va a hacer

&nbsp;