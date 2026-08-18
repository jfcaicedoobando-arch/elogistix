# Olas 3, 3b y 4 — copy de Cobranza, migas y confirmaciones sin catch

Tres cambios chicos, verificados como pendientes en el código actual.

## Ola 3 — "Cartera" → "Cobranza" (texto visible)
La pantalla `/cobranza` sigue titulándose "Cartera" y el dashboard ejecutivo dice "Cartera vencida", aunque el sidebar y las migas ya dicen "Cobranza".
- `Cartera.tsx`: `useDocumentTitle("Cobranza")` y `PageHeader title="Cobranza"`.
- `BandaKPIs.tsx`: "Cartera vencida (>30d)" → "Cobranza vencida (>30d)"; título del drilldown "Cartera vencida" → "Cobranza vencida".
- No se renombran rutas, archivos ni identificadores de datos (`kpis.cartera_vencida_mxn` queda igual).

## Ola 3b — Migas "Por aprobar" / "Por pagar"
Las rutas `/compras/por-aprobar` y `/compras/por-pagar` existen, pero no tienen entrada en el mapa de etiquetas de `Breadcrumbs.tsx`, así que se muestran con guion ("Por-aprobar"). Se agregan las dos etiquetas junto a "Por capturar".

## Ola 4 — `await onConfirm()` sin catch en diálogos base
Hoy `ConfirmActionDialog` y `DoubleConfirmDeleteDialog` hacen `await onConfirm()` pelón. Si un caller propaga el error (por ejemplo `mutateAsync` sin try/catch), queda una promesa rechazada suelta y, en el diálogo de doble confirmación, el `close()` posterior nunca corre: el modal se queda atorado. Analogía: es como un cinturón de seguridad que sólo funciona si el conductor se acuerda de ponérselo; lo movemos al coche.
- `ConfirmActionDialog`: `try/catch` con `console.error` (el hook del caller sigue notificando al usuario).
- `DoubleConfirmDeleteDialog`: mismo `try/catch` en el botón y en el Enter del input; `close()` sólo en éxito, para que el usuario pueda reintentar o cancelar.
- Fuera de alcance (tienen su propio `await onConfirm` inline y se atienden en su ola): `EliminarFacturaCxpDialog`, `RechazarFacturaEntranteDialog`, `MarcarCapturadaDialog`, `CancelarEmbarqueDialog`, `ReasonDialog`.

## Detalles técnicos
- Archivos a editar: `src/features/bandejas/routes/Cartera.tsx`, `src/features/dashboardEjecutivo/components/BandaKPIs.tsx`, `src/components/layout/Breadcrumbs.tsx`, `src/components/shared/dialogs/ConfirmActionDialog.tsx`, `src/components/shared/DoubleConfirmDeleteDialog.tsx`.
- Tests: un caso nuevo en `DoubleConfirmDeleteDialog.test.tsx` (rechazo de `onConfirm` no lanza y el diálogo no se cierra) y uno para `ConfirmActionDialog`. Revisar tests existentes que aserten los textos "Cartera".
- Cierre: `APP_VERSION` a `13.668.0` + entrada en `CHANGELOG.md`, y correr lint, typecheck, `audit:arch`, `audit:tests` y los tests afectados.
