# Plan — Tanda 2 (QW5-QW8) del módulo Facturación

Continuación de Tanda 1 (v13.312.26 ya en producción). Este PR ataca la **fricción diaria** con 4 quick wins independientes.

---

## QW5 · Botón "TC DOF Banxico" en Nueva Factura (+ EUR)

**Objetivo:** que al capturar una factura manual en USD o EUR, un botón traiga automáticamente el tipo de cambio publicado por Banxico (DOF), como ya existe en el detalle.

**Cambios:**

- `DialogNuevaFactura` (y su sección de moneda): añadir botón "Traer TC DOF" junto al input `tipo_cambio`, visible sólo cuando `moneda ∈ {USD, EUR}`.
- Ampliar `useBanxicoTipoCambio` para soportar `EUR` (hoy sólo `USD`) usando la misma serie SF57923 pattern o serie EUR/MXN de Banxico.
- Feedback: `notifyInfo`/`notifySuccess` con la fecha del TC.

**Analogía:** hoy el usuario copia el TC de otra pestaña; con esto es un botón, como el que ya usa cuando la factura ya existe.

---

## QW6 · Resumen de "qué falta" junto al botón deshabilitado

**Objetivo:** cuando el submit de un diálogo del módulo está `disabled`, mostrar en línea qué campos faltan (sin migrar a RHF+Zod — eso es Ola 1).

**Alcance (los 3 diálogos de más fricción):**

- `DialogNuevaFactura`
- `DialogTimbrar`
- `DialogRegistrarPago`

**Cómo:** helper `useFaltantes(campos)` que devuelva `string[]` de labels vacíos y un componente `<FaltantesHint items={...} />` que se renderiza sólo cuando el botón está `disabled`.

---

## QW7 · Menú ⋮ por fila con acciones no destructivas

**Objetivo:** reducir 2 navegaciones por documento a 0 en bandejas de alto volumen.

**Alcance:**

- Tablas: **Emitidas**, **Por Timbrar**, **Por Enviar**, **Por Cobrar**.
- Acciones en el menú (según estado de la fila):
  - Timbrar (fast-path, sólo borradores válidos)
  - Registrar pago (sólo emitidas con saldo)
  - Enviar por email
  - Descargar PDF / XML
- **NO se incluyen** Cancelar ni Eliminar (siguen únicamente en el detalle) — se documenta el nuevo criterio en `CHANGELOG` porque revierte parcialmente v13.172.12.

**Reuso:** los diálogos (`DialogTimbrar`, `DialogRegistrarPago`, `EnviarDocumentoDialog`) ya son componentes independientes; sólo se abren desde el nuevo menú.

**Guardas UX:** `e.stopPropagation()` en el trigger del menú (regla Core de la memoria).

---

## QW8 · Envío masivo de email + acción "Enviar" en bandeja PorEnviar

**Objetivo:** terminar el stub actual de reenvío masivo y dar botón "Enviar" a la bandeja PorEnviar (hoy no envía nada).

**Cambios:**

- Reemplazar el `toast.info("en preparación")` por el flujo real:
  1. Selección múltiple en la tabla.
  2. `AlertDialog` de confirmación con conteo y preview del destinatario principal.
  3. Encolar N envíos vía `process-email-queue` usando la plantilla `factura-reenvio` (ya existe).
  4. Reporte final: toast con `X enviadas / Y con error` y detalle en `bitacora_actividad`.
- En bandeja **Por Enviar**: botón "Enviar" por fila y toolbar "Enviar seleccionadas" que reutilizan el mismo flujo.

**Sin automatización** (dunning automático es Ola 1 / QW10).

---

## Detalles técnicos

- **Archivos previstos** (a confirmar al implementar):
  - `src/features/facturacion/components/dialogs/DialogNuevaFactura/*`
  - `src/features/facturacion/hooks/useBanxicoTipoCambio.ts`
  - `src/features/facturacion/components/FaltantesHint.tsx` (nuevo)
  - `src/features/facturacion/components/tables/*RowActions.tsx` (nuevo, compartido)
  - `src/features/facturacion/hooks/useEnviarFacturasMasivo.ts` (nuevo)
- **DB / edges:** no requiere migraciones nuevas — todas las tablas, RPCs (`facturapi-enviar-email`, `process-email-queue`) y campos ya existen.
- **Tests:**
  - Unit: `useBanxicoTipoCambio` (rama EUR), helper de faltantes, hook de envío masivo (mock cola).
  - Behavioral: menú ⋮ dispara el diálogo correcto; el submit masivo confirma y reporta.
- **Changelog + `APP_VERSION`:** bump a `13.313.0` (nueva mini-tanda visible).
- **A11y:** los nuevos triggers de menú/botón siguen el patrón `FormDialogShell` + `aria-label` estándar.

## Fuera de alcance (siguiente Tanda)

- QW9 Aging A/R
- QW10 Recordatorios de cobranza
- QW11 Fixes a11y fiscales
- QW12 Envío del estado de cuenta por email

No hacemos el qw7