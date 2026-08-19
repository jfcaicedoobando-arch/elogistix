# Auditoría externa 2026-08-19 — plan de remediación

Verifiqué contra el código los hallazgos más graves del documento. Resultado: **9 de 10 confirmados**, y **uno es falsa alarma** (lo explico abajo). El orden que propongo va de dinero/seguridad hacia pulido visual.

## Corrección al hallazgo EC-1 (`.env` commiteado)

Revisado hoy: `.env` sí está en el árbol, pero su contenido son **solo llaves publicables** (`SUPABASE_PUBLISHABLE_KEY`, URL del proyecto, `VITE_SENTRY_DSN`). No hay service role ni password de base de datos. Esas llaves están diseñadas para viajar en el bundle del navegador, así que **no hay filtración**. Además ese archivo lo genera y mantiene la plataforma: no debo borrarlo ni reescribirlo. No hay nada que rotar aquí.

Analogía: es como preocuparse porque el número de teléfono público de la oficina está en el directorio. La llave de la caja fuerte sigue guardada.

---

## Ola A — Dinero y seguridad (primero)

| # | Hallazgo | Verificado | Arreglo |
|---|---|---|---|
| BL-1 | `facturaManual.ts:86` fuerza `Math.round(cantidad)`: 1.5 toneladas se timbran como 2 | Sí | Conservar decimales usando el mismo `parseCantidadFiscal` de la ruta de conceptos |
| BL-2 | `facturaManual.ts:44` `addDays` local: fuera de CDMX el vencimiento cae un día antes | Sí | Usar el canon `addDaysIso` de `src/lib/date/dateOnly.ts` |
| BL-3 | `cotizacion/services/wizard.ts:44` escribe `msds_archivo = null` al editar sin re-subir PDF | Sí | En UPDATE, omitir el campo salvo que haya archivo nuevo |
| EC-3 | `supabase/functions/tracking-public` no llama `check_ratelimit` (único endpoint público sin él) | Sí | Mismo patrón fail-closed por IP + tope global |
| EC-2 | `demo-access` resetea el password demo en cada llamada | Sí | Resetear solo si hace falta; conservar el tope de 30/h |

Cada punto queda con prueba: cantidad decimal timbrada, vencimiento con TZ simulada distinta de CDMX, y edición de cotización peligrosa que conserva MSDS.

## Ola B — Coherencia visual (lo que más se nota, cero riesgo funcional)

- **UI-1:** registrar dominios `cfdi`, `proforma`, `lead`, `conciliacion` en el statusRegistry y migrar `CfdiEstadoBadge`, `proformasColumns`, `leadsColumns` y `PanelConciliacionEstados` a `StatusBadge`.
- **UI-2:** una sola escala de antigüedad con los tokens `--aging-1..5`; hoy Cobranza, Cartera y CxC pintan la misma deuda con colores distintos.
- **UI-3:** quitar `getModoIcon` (emoji) del barril y cambiar el `⚠️` de `DoubleConfirmDeleteDialog` por `<AlertTriangle>`.
- **UI-4 / UI-7:** un solo `CargaGuard` por ruta y `EmptyState` compartido en Tesorería.
- **UI-11 / UI-12 / UI-13:** `ChartTooltip` compartido con tokens (dark mode), bajar la saturación del panel de alertas y revisar contraste de aging.
- **UI-9 / UI-15 / UI-17 / UI-20:** barrido mecánico a `Badge size="xs"`, quitar CTAs duplicados en móvil, usar `.text-overline`, homologar micro-copy.
- **UI-6:** pasar CxP, Cartera y catálogos a `ResponsiveDataTable` + `mobileCard`.

## Ola C — Lógica de negocio

- **BL-4:** quitar la doble escritura de totales de factura (cliente + trigger) para evitar que dos usuarios se pisen; dejar solo el trigger o una RPC transaccional.
- **BL-5:** resolver el T/C DOF de la fecha del pago para que un cobro USD en cuenta MXN genere movimiento bancario.
- **BL-7:** KPI de comisiones liquidadas por `liquidaciones_comision.fecha_pago`, no por fecha de devengo.
- **BL-8:** notas de crédito toman el modo real de la factura padre en lugar del `"Marítimo"` fijo.
- **BL-9 / BL-11 / BL-12 / BL-16 / BL-18:** una sola definición de "por vencer", `roundMoney` en CxP, normalizar null/undefined antes de exigir re-aprobación, rechazar fechas futuras en `exchange-rates`, y no marcar "T/C incompletos" en embarques 100% MXN.

## Ola D — Robustez

- **EC-7:** `useCotizacionesPageController.ts:30-32` filtra con `.toLowerCase()` sin protección: una fila con null tumba la página entera. Optional chaining + schema `nullish()`.
- **EC-4 / EC-5:** schema zod por paso del wizard de cotización y salida con dirty-guard.
- **EC-6:** incluir `organizationId` en la clave del borrador (`lc:cotizacion:draft:${userId}`) para que un super admin no restaure el borrador de otro tenant.
- **EC-10 / BL-10:** paginación server-side donde hoy hay cap silencioso de ~1000-2000 filas.
- **EC-13 / EC-18:** `confirmDiscard` en `FormDialogShell`, `disabled={submitting}` y `client_request_id` en mutaciones financieras.
- **EC-11 / EC-12 / EC-15 / EC-16 / EC-17:** distinguir vacío de 0 en montos, negativos explícitos, `accept`/`maxSizeMb` en `DocumentChecklist`, Enter que no salte pasos, y no mostrar `error.message` crudo en el tracking público.

## Guardarraíles CI (junto con cada ola)

- Grep bloqueante de `text-(red|green|amber|blue)-\d`, hex fuera de tokens, `getModoIcon`, `bg-white`/`bg-black`.
- Test de arquitectura que prohíba `Math.round` en rutas monetarias y `new Date(string)` en lógica fiscal sin los helpers de `dateOnly`.

## Notas técnicas

- Cada ola se entrega por separado: cambio + prueba + guardarraíl + entrada en `CHANGELOG.md` con bump de `APP_VERSION`.
- Verificación por ola: `tsgo --noEmit`, `eslint src`, suite completa de Vitest y las pruebas de arquitectura.
- Los cambios de base de datos (BL-4, BL-6, EC-3) van como migraciones nuevas; no se editan migraciones ya aplicadas.
