# Plan de continuación — Olas Elogistix (pre-major release)

El documento subido lista 6 olas. Varias ya se ejecutaron en sprints previos (v13.680.0–v13.682.0): BL-1, BL-2, BL-3, EC-3 (rate limit en `tracking-public`), UI-1 (statusRegistry), UI-2 (escala de aging unificada) y UI-3 parcial (emojis y `getModoIcon`). BL-5 también está resuelto: el cobro cross-moneda ya exige TC y no abona con moneda distinta.

Este plan cubre lo que queda, en el mismo orden de criticidad.

## Ola 1 — Seguridad (parcial, con una limitación)

- **1.1 `.env` en el repo (EC-1):** el archivo está versionado, pero en este proyecto `.env` es autogenerado por la plataforma y solo contiene claves publicables (URL + anon key), que son públicas por diseño. No puedo reescribir historial de git ni rotar claves desde aquí. Acción propuesta: dejarlo como está y documentar en `SECURITY.md` por qué no es un secreto; si quieres rotar la anon key, se hace desde la plataforma y lo coordinamos aparte.
- **1.3 `demo-access` (EC-2):** no resetear el password si no cambió, y registrar/alertar el abuso del bucket de rate limit. El CAPTCHA queda fuera de alcance salvo que quieras añadir Turnstile (requiere clave).

## Ola 2 — Dinero incorrecto

- **2.4 (BL-4):** eliminar la doble escritura de totales de factura. `recalcularTotalesFactura.ts` calcula y escribe totales desde el cliente mientras el trigger de base de datos hace lo mismo; dos sesiones editando conceptos pueden descuadrar `facturas.total`. Se convierte en una RPC transaccional (o se elimina el UPDATE cliente y se relee el total del trigger), y se limpia el ruido de la bitácora.

## Ola 3 — Coherencia visual (lo que queda)

- **3.4 (UI-4):** un único guard de carga/error. `CargaGuard` ya existe y está adoptado en ~20 rutas; faltan `PortalEmbarques`, `ProfitEstadoResultados` y `PortalDashboard`, que hacen early-return antes del `PageHeader`. Se añade guardrail que prohíbe ese patrón.
- **3.5 (UI-5):** `TablaFlujoSemanal` migra a `DataTable` (o al menos a `TABLE_DENSITY`).
- **3.6 (UI-6):** estrategia responsive única con `ResponsiveDataTable` + `mobileCard` en CxP, Cartera y `TabPuertos`; se elimina `CarteraMobileList`.
- **3.7 (UI-7):** empty states inline de Tesorería/Conciliación al componente compartido.
- **3.8 (UI-8):** matriz de severidad destructiva documentada en `docs/design-system.md` y aplicada: catálogos con `DeleteConfirmDialog`, documentos con dependencias con doble confirmación.
- **3.3 cierre:** borrar el `getEstadoColor` deprecado y su allowlist.

## Ola 4 — Pulido visual fino y dark mode

Los 10 puntos tal como vienen (ChartTooltip compartido, panel de alertas, contraste WCAG del aging, badges `size="xs"`, tipografía del portal, CTAs/FAB duplicados, KpiCard consistente, slots de PageHeader, `StatTile` compartido, micro-copy).

## Ola 5 — Business logic residual (KPIs y reportes)

Los 9 puntos: comisiones liquidadas por `fecha_pago`, modo real de notas de crédito en EERR, cola de recálculo de comisión, una sola definición de "por vencer", `roundMoney` en CxP, `quedaCubierta: false` con estimados, "hoy" en CDMX, FIFO con desempate por `fecha_emision`, y `registrarPagoProveedor` transaccional.

## Ola 6 — Robustez y edge cases

Se priorizan 6.1–6.3 (filtro null-safe de cotizaciones, `try/catch` + `notifyError` al subir factura entrante, y clave de borrador con `organizationId` para evitar fuga entre organizaciones). El resto (6.4–6.10) queda como endurecimiento posterior.

## Guardarraíles de CI

Añadir a la batería de tests de arquitectura: grep bloqueante de colores crudos y hex fuera de tokens, prohibición de `Math.round` en rutas monetarias sin justificación, y prohibición de `new Date(string)` en lógica fiscal (usar los helpers de `dateOnly`).

## Notas técnicas

- Cada ola se entrega por separado con bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
- Todos los fixes de dinero llevan test de regresión; los visuales llevan guardrail de arquitectura para que no regresen.
- Los cambios de base de datos (BL-4, 5.9) se hacen vía migración con RPC `SECURITY DEFINER` y GRANT explícito.

## Pregunta de alcance

Propongo ejecutar en este orden: Ola 2.4 → Ola 3 restante → Ola 6.1-6.3 → Ola 5 → Ola 4. Si prefieres empezar por el pulido visual (Ola 4), dímelo y reordeno.
