# Cerrar Olas 2, 3 y 4 (post re-auditoría)

## Estado verificado de la Ola 2

Ya está cerrada: los usos crudos de `text-xs` en TSX están en 326 (criterio: <400) y existen los candados `chart-tooltip.test.ts`, `portal-page-shell.test.ts` y el registro de badges. No requiere trabajo nuevo.

## Ola 3 — Lógica de negocio residual

Lo que la revisión encontró (con evidencia en código):

1. **Comisiones en $0 sin rastro (3.1)** — `calcular_comision_pago` pone la comisión en cero en tres caminos (pago eliminado, cliente/embarque sin comisión, utilidad no positiva) y solo deja una nota de texto libre. No hay cola ni tabla de excepciones.
   Acción: crear tabla `comisiones_excepciones` (org, pago, embarque, motivo, monto esperado, fecha), escribirla desde la RPC en cada rama de cero, y mostrarla como aviso en el módulo de Comisiones con acción "recalcular".
2. **Reparto FIFO visible ≠ aplicado (3.6)** — `DialogCobroLoteRenglones` reordena a mano solo por fecha de vencimiento, mientras el reparto real usa `ordenarFifo` (vencimiento → emisión → id).
   Acción: usar `ordenarFifo` en el diálogo.
3. **Ceros silenciosos al recalcular (3.7)** — `recalcularTotalesFactura` aplica `?? 0` tras el re-SELECT; si RLS oculta la fila, los totales quedan en cero sin error.
   Acción: lanzar error de dominio cuando no regresa fila.
4. **KPI de comisiones truncable (3.9)** — `fetchLiquidadoMxnPorMes` usa tope de filas sin `assertNotTruncated`.
   Acción: agregar la aserción, como en Cobranza.
5. **Moneda desconocida en `aUSD` (3.5)** — hoy devuelve el monto sin convertir, etiquetado como USD.
   Acción: devolver `null` y que los consumidores muestren "sin T/C" en lugar de un número falso.
6. **Tipo de cambio por fecha futura (3.4)** — el servicio ya rechaza fechas futuras y cae a hoy, pero la respuesta no dice qué fecha pidió el cliente.
   Acción: exponer también `fechaSolicitada` para que la interfaz pueda avisar "se usó el T/C del día X".
7. **Comentario de convención T/C (3.8)** — la convención "factor pago→factura" sigue vigente en la RPC actual, no está obsoleta. Se documenta en `docs/` en lugar de borrarla.

Fuera de alcance en esta ola: **3.2 (reparación del dato histórico de F1034)**, porque el REP de esa factura ya se timbró con éxito tras el arreglo de tipo de cambio; y **3.3 (filtro de estatus en SQL)**, porque Cobranza ya está protegida con `assertNotTruncated` sobre el tope de 2000. Si quieres forzar la migración de datos o empujar el filtro a una RPC de todas formas, dime y lo agrego.

## Ola 4 — Robustez de formularios

1. **Confirmar antes de descartar (4.2)** — `FormDialogShell` cierra sin preguntar. Se le agrega soporte de "hay cambios sin guardar" (ESC y clic fuera piden confirmación) y se adopta en Cuentas de Tesorería y en Nueva factura manual.
2. **Salir del asistente sin aviso (4.6)** — el botón "Volver" del asistente navega directo; la guardia actual solo intercepta enlaces. Se enruta ese botón por la confirmación de salida.
3. **Tope de monto solo al salir del campo (4.3)** — `MoneyInput` limita el máximo únicamente al perder el foco. Se limita también al escribir, con aviso visual, y se adopta el máximo en las capturas de cobro/pago (no se puede capturar más que el saldo).
4. **Archivos adjuntos sin filtro (4.4)** — `DocumentChecklist` acepta cualquier archivo y cualquier tamaño. Se añaden tipos permitidos (PDF, imágenes, XML) y tamaño máximo por defecto, con mensaje claro al rechazar.
5. **Validación por paso con esquema (4.1)** — el asistente de cotización valida a mano. Se definen esquemas por paso y se conecta al formulario, dejando los mensajes en un solo lugar, con pruebas por paso.
6. **Enter en el asistente (4.5)** — ya está implementado: Enter avanza solo desde campos de captura y respeta listas abiertas. Sin cambios.
7. **Cuenta demo (4.7)** — el reinicio de contraseña en cada acceso es intencional y está documentado como tal. Se deja igual y se anota el riesgo aceptado.

## Verificación

Pruebas nuevas para: cola de excepciones de comisiones, FIFO del diálogo, error al no encontrar factura en el recálculo, moneda inválida en la conversión, confirmación de descarte, tope en `MoneyInput`, filtro de archivos y validación por paso. Al final: lint, suite completa, auditorías de migraciones/arquitectura y build. Se bumpea `APP_VERSION` y se registra en `CHANGELOG.md`.

## Detalle técnico

- **3.1**: migración `comisiones_excepciones` (PK uuid, `organization_id`, `pago_id`, `embarque_id`, `motivo` enum texto: `pago_eliminado|sin_comision|utilidad_no_positiva`, `detalle jsonb`, `resuelta_en`), con `GRANT SELECT` a `authenticated`, `GRANT ALL` a `service_role`, RLS por `organization_id` y política de lectura para roles financieros; `INSERT ... ON CONFLICT` desde `calcular_comision_pago` en las tres ramas de cero. UI: sección en Comisiones con `EmptyStateInline` + `DataTable` y botón que invoca la RPC de recálculo.
- **3.6**: `src/features/facturacion/components/DialogCobroLoteRenglones.tsx` → `ordenarFifo` de `src/lib/domain/fifoVencimiento.ts`.
- **3.7**: `recalcularTotalesFactura.ts` → si `maybeSingle()` no trae fila, `throw` con código `LC_FACTURA_RECALC_SIN_FILA` (registrar descripción en el catálogo LC para no romper `lc-codes-sql-wiring.test.ts`).
- **3.9**: `src/features/comisiones/services/liquidaciones.ts` → `assertNotTruncated(data, CAP_LISTA, "comisiones.fetchLiquidadoMxnPorMes")`.
- **3.5**: `costosUSD.ts#aUSD` retorna `number | null`; ajustar consumidores y tests.
- **3.4**: `supabase/functions/exchange-rates/index.ts` → agregar `fechaSolicitada` al contrato y al tipo del cliente.
- **4.2**: props `hasUnsavedChanges?: boolean` + `onConfirmDiscard?` en `FormDialogShell` reutilizando `useDirtyGuard`/`confirmarSalida`; adopción en `TesoreriaCuentas.tsx` y `DialogNuevaFacturaManual.tsx`.
- **4.6**: `WizardShell` recibe `onBack` envuelto por `confirmarSalida` en `NuevaCotizacion.tsx` y `EditarCotizacion.tsx`.
- **4.3**: clamp de `max` en `handleChange` de `MoneyInput` + `aria-describedby` con aviso; adopción en diálogos de cobro/pago.
- **4.1**: `src/features/cotizacion/schemas/pasos/*.ts` (zod por paso) consumidos por `useCotizacionWizardSteps` vía `zodResolver` dinámico.
- Cada archivo tocado se mantiene ≤200 líneas (Power of 10); se dividen helpers si hace falta.
