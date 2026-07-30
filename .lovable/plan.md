# Ronda 3 — Correcciones auditoría (R-01 … R-15)

Verifiqué cada hallazgo contra el código actual antes de planear. Resumen de lo confirmado y lo que falta confirmar en ejecución.

## Confirmado en código (se corrige directo)

**R-01 · Crítico — corrupción de Cant/Costo/Venta en el wizard (Paso 2)**
- `parseInputNumero.ts` tiene `CANTIDAD_MAX = 9_999` y `parseCantidad` hace `Math.min(...)`: reescribe silenciosamente 15000 → 9999. Confirmado.
- En `FilaCostoLocalRow.tsx` solo **Cant.** tiene estado de edición local; **Costo** y **Venta** son inputs controlados contra el estado global y con `onFocus` que pisa `e.target.value`. Confirmado.
- Fix: quitar el clamp (validación con mensaje, no reescritura), y aplicar el mismo patrón de edición local (raw en foco, commit en blur) a los tres campos con un helper reutilizable. Test de regresión 2 / 15000 / 20000.

**R-03 · Alta — "Error al crear proveedor: undefined"**
- `useProveedoresCrear.ts` llama `notifyError` sin pasar `error`, por eso el toast sale "undefined". Confirmado.
- Fix: propagar `error`, construir el payload con whitelist explícita de columnas y validar `categoria`/`tipo`/`subtipo_gasto` antes de enviar. Mismo tratamiento en la mutación de `costeo_rutas`.

**R-04 · Alta — RLS de `catalogo_claves_sat` excluye a ventas**
- La policy CRUD sólo lista admin / admin_org / contador / super_admin. Confirmado.
- Decisión tomada: **no** se amplía la policy. Se oculta el CTA "Crear concepto" para `ejecutivo_pricing`; ventas usa sólo "concepto libre". Sin migración.

**R-08 · Media-alta — enviar cotización en $0**
- `CotizacionDetalleHeader.tsx` no evalúa totales: "Enviar por correo" siempre habilitado. Confirmado.
- Fix: deshabilitar con tooltip cuando no hay importes de venta + guarda en la RPC de envío.

**R-02 · Crítico — detalle de cotización sin acciones de flujo**
- El header sólo expone Exportar PDF / Enviar por correo. Confirmado.
- Fix: botón "Editar / Completar" (estados Borrador y Solicitada) que abre el wizard con `cotizacionId`; CTA "Completar y enviar" para Solicitada; "Cambiar estado" con transiciones válidas por rol; bloqueo en estados finales.

**R-13 · Media — pluralización y microcopy**
- El helper existe (`src/lib/format/pluralizar.ts`) pero no se usa en los contadores reportados. Confirmado.
- Fix: sustituir interpolaciones `${n} cotizaciones`, `usuario(s)`, `factura(s)`; mapa de roles a etiqueta legible en sidebar/perfil; títulos de pestaña de /inicio y /cotizaciones.

**R-14 · Media — "R3" se renderiza como "R"**
- Causa raíz encontrada: `toTitleCase` en `src/lib/formatters/text.ts` hace `original.replace(/\d+$/, "")`, eliminando dígitos finales de cada token. Afecta cualquier vista que pase nombres por `toTitleCase`, no sólo proveedores.
- Fix: dejar de recortar dígitos en `toTitleCase` y ajustar los tests que dependan de ese comportamiento.

**R-10 · Media — alta de navieras**
- Existe `NavieraFormDialog` y alta en Configuración → Navieras, pero la ruta `/costeo/navieras` no ofrece CTA. Fix: reutilizar el diálogo existente ahí (botón + empty-state) y verificar la policy de INSERT.

## Requiere diagnóstico antes del fix (no asumo causa)

- **R-05** skeletons infinitos y ruta sin permiso: aplicar `LoadingState` con timeout/reintento de forma transversal, resolver rol antes de disparar queries, y estado "no encontrado" en detalles. Antes de tocar el portal, instrumentar qué query se cuelga al arranque.
- **R-06** empty-state falso en /cotizaciones: revisar si KPIs y tabla usan queries distintas; unificar fuente y no renderizar vacío fuera de `isSuccess`.
- **R-07** HTML crudo en toasts: no encontré sanitización por content-type en `appFeedback`; añadir descarte de cuerpos no-JSON y auditar los ~249 puntos que llaman `notifyError` para exigir `error`.
- **R-09** restaurar borrador vuelve vacío: depurar `loadDraft` y la carrera con el autosave (`restoringRef`) antes de cambiar la restauración.
- **R-11** `/embarques` accesible por URL a ventas: existe `roleRouteMatrix.ts`; confirmar si `ejecutivo_pricing` está en el guard y alinear menú y matriz.
- **R-12** deep links: no encontré manejo de `returnTo` en el guard de auth; añadir `state.from` y evitar el flash de sidebar durante el redirect.
- **R-15** UX miscelánea: confirmación al cerrar Nuevo Cliente, campo "Días de crédito" ("030"), export PDF sin datos, empty-states en /admin/diagnostico, hit-area de "Ver detalles" vs org-switcher, copy de error para mutaciones.

## Orden de ejecución

1. R-01, R-03 (riesgo financiero y operación bloqueada)
2. R-02, R-08, R-04
3. R-05, R-06, R-07, R-09
4. R-10, R-11, R-12, R-13, R-14, R-15

Cada bloque con sus tests (unitarios de lógica + E2E donde el hallazgo lo pide). Al cerrar: bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
