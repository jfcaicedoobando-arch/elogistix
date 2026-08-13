# Refacturación a otro receptor (cliente pagó desde la empresa equivocada)

## Qué ya existe hoy (verificado en el código)

- Cancelar REP: función `facturapi-cancelar-rep` con timeout, reconciliación y re-timbrado posterior (`claimRep.ts` permite volver a timbrar un REP cancelado).
- Cancelar factura con motivos SAT 01–04, acuse, pre-flight de sustitución y guard de misma organización (`facturapi-cancelar`).
- Wizard de sustitución motivo 01 (`DialogSustituirFactura`) + RPC `duplicar_factura_para_sustitucion`, que copia conceptos y vínculos de embarque (`factura_embarques`).
- Eliminar (cancelar) el pago con borrado lógico, bloqueado si el REP sigue vivo (`LC_PAGO_CON_REP_VIVO`), y baja del movimiento bancario generado por el cobro.
- Conciliación de movimientos bancarios con `conciliarConPago` / `desconciliar`.
- Factura manual nueva con selección de cliente y datos fiscales (`DialogNuevaFacturaManual`).

## Qué falta (los huecos reales)

1. `duplicar_factura_para_sustitucion` copia `cliente_id` y `rfc_cliente` de la original: no hay forma de cambiar el receptor en el borrador. Hoy habría que crear la factura desde cero y perder el vínculo `sustituye_a`.
2. No existe reasignación de pago: el pago se borra y se recaptura a mano; el movimiento bancario importado queda apuntando a un pago borrado (traza rota) y hay que reconciliar de nuevo manualmente.
3. No hay registro del "ordenante real" del depósito: si el dinero llegó de otra empresa, nada lo documenta en la factura nueva ni en el REP.
4. No hay un flujo guiado que ordene los 5 pasos ni valide el orden correcto; el operador puede intentar cancelar la factura antes del REP y chocar contra los candados.
5. La bitácora registra cada paso por separado, sin un identificador de "caso de refacturación" que amarre todo en la línea de tiempo del embarque.

## Lo que vamos a construir (por etapas)

### Etapa 1 — Base de datos y trazabilidad
- Nueva tabla `refacturaciones` (caso): factura original, factura nueva, cliente origen/destino, ruta fiscal (`01` o `02`), estado del caso, paso actual, motivo, embarque.
- Nuevo campo en `pagos_factura`: `ordenante_distinto` (bool) + `ordenante_nombre`/`ordenante_rfc` para documentar que el depósito vino de otra empresa.
- RPC `reasignar_pago_factura(p_pago_id, p_factura_destino, p_caso_id)`: en una sola transacción cancela el pago viejo, crea el pago nuevo en la factura destino con los mismos datos (fecha, monto, moneda, TC, forma de pago), traslada el vínculo del movimiento bancario (`bbva_movimientos.pago_factura_id`) y deja el movimiento conciliado. Valida: REP del pago viejo cancelado, factura destino timbrada y viva, misma moneda, y que no se sobrepase el saldo.
- RPC `duplicar_factura_para_refacturacion(p_factura_id, p_cliente_destino_id)`: igual que la de sustitución, pero tomando cliente, RFC, régimen y uso CFDI del cliente destino, y marcando `sustituye_a` sólo cuando la ruta es motivo 01.

### Etapa 2 — Asistente "Refacturar a otro receptor"
Wizard de 5 pasos en el detalle de factura, con estado persistido en el caso (si el usuario sale, retoma donde iba):
1. Elegir ruta fiscal (02 recomendado cuando cambia el RFC; 01 si el contador lo autoriza) y cliente destino.
2. Cancelar el REP timbrado (con acuse).
3. Crear el borrador de la factura nueva al cliente destino y timbrarlo.
4. Cancelar la factura original (motivo 02, o 01 relacionando la nueva).
5. Reasignar el pago a la factura nueva y confirmar la conciliación bancaria (con la nota de ordenante distinto).

Cada paso muestra bloqueado/listo según el estado real en base de datos, no según lo que el usuario cree.

### Etapa 3 — Trazabilidad del embarque y cierre
- Banner en el embarque y en ambas facturas: "Refacturada · caso #, ver factura nueva/original".
- Los vínculos `factura_embarques` quedan: original `activa = false`, nueva `activa = true` (ya soportado); se revisa que los conceptos de venta y el P&L del embarque tomen sólo la vigente.
- Entradas de bitácora con el mismo `caso_id` para que la línea de tiempo del embarque cuente la historia completa.
- Regla de auditoría operativa nueva: caso de refacturación abierto más de N días o pago sin reasignar.

## Notas fiscales
- Cuando cambia el RFC del receptor, la ruta segura es cancelar con motivo 02 y emitir una factura nueva; relacionar una sustitución (motivo 01) con receptor distinto puede ser rechazada por el PAC. El ERP soportará ambas y avisará el riesgo al elegir 01.
- El depósito se queda: el REP de la factura nueva se timbra con los datos del pago y el caso deja constancia de que el ordenante fue otra empresa (respaldo ante aclaraciones).

## Detalles técnicos
- Migraciones: tabla `refacturaciones` con GRANTs y RLS por `organization_id` (roles fiscales), columnas nuevas en `pagos_factura`, dos RPC `SECURITY DEFINER` con `REVOKE ALL` + GRANT a `authenticated`/`service_role` (regla H6) y espejo en `supabase/schema/`.
- Frontend: `src/features/facturacion/components/refacturacion/` (wizard con `FormDialogShell` + `FormDialogStepper`), hook de estado del caso, servicios en `services/refacturacion.ts`. Archivos ≤200 líneas, sin `any`, cleanup en efectos.
- Códigos de error nuevos con mensaje en español en `lcCodeMessages`: `LC_REFACT_REP_VIVO`, `LC_REFACT_MONEDA`, `LC_REFACT_FACTURA_NO_TIMBRADA`, `LC_REFACT_SOBREPAGO`.
- Pruebas: unitarias de los servicios y del reductor del wizard; SQL de RLS/candados para la RPC de reasignación; E2E del flujo completo.
- `APP_VERSION` + `CHANGELOG.md` en cada etapa.

## Orden de entrega
Etapa 1 (base de datos y RPCs) → Etapa 2 (asistente) → Etapa 3 (trazabilidad y auditoría). Cada etapa queda usable por sí sola.
