# Plan · Tanda 1 Quick Wins Facturación (QW1–QW4)

Aviso: `.lovable/` está en `.gitignore`, así que este plan no se versiona. ¿Quieres que quite esa entrada para que el plan quede persistido en el repo? Puedo hacerlo al inicio del build si lo confirmas.

Objetivo: cerrar 4 gaps visibles sin tocar lógica financiera. Cada QW es un commit independiente detrás del mismo bump de versión.

---

## QW1 · Conectar PDF y CSV de Estado de Cuenta

**Problema:** `ExportActions.tsx` tiene los dos botones (`PDF`, `Excel`) `disabled` con TODO. El generador `src/generators/estadoCuentaPdf.ts` ya existe y funciona (tiene tests).

**Cambios:**

- `src/features/facturacion/estadoCuenta/components/ExportActions.tsx`: recibir por props `clienteIds`, `desde`, `hasta`, `rows`, `kpis`. Habilitar botones cuando `clienteIds.length===1` (PDF firma un cliente) y siempre para CSV.
- Botón PDF → llama a `generarEstadoCuentaPdf` (leer su firma y armar el header cliente desde `useEstadoCuenta` o un fetch mínimo).
- Botón Excel → renombrar a **CSV** (rótulo + ícono `FileSpreadsheet`) y usar el helper puro existente `src/generators/exportCsv.ts`. Nombre: `EstadoCuenta_{Cliente}_{YYYYMMDD}.csv`.
- `EstadoCuentaModule.tsx`: pasar props a `<ExportActions/>`.
- Feedback con `notifySuccess`/`notifyError` (los helpers unificados).

**Tests:** unit test que renderiza `ExportActions` habilitado/deshabilitado y verifica que se invoquen los generadores (mock).

---

## QW2 · REP descargable en portal + auto-envío al timbrar

**Problema:** `pagos_factura.rep_pdf_url / rep_xml_url` se pueblan al timbrar el REP, pero el portal del cliente no los muestra y no se dispara email automático (aunque la edge `facturapi-enviar-email` ya acepta `pago_id`).

**Cambios:**

- `src/features/portal/services/queries.ts` (query de pagos): agregar `rep_pdf_url, rep_xml_url, rep_uuid, id` al select whitelist (respetar `portal-columns-whitelist.test.ts` — actualizar si falla).
- `PortalFacturaPagosCard.tsx`: cuando el pago tenga REP timbrado, mostrar dos botones **REP PDF / REP XML** que abran signed URL vía `openFacturaInNewTab` (o análogo si el bucket es distinto — verificar en build). Si el REP aún no está timbrado, sin botón.
- `src/features/facturacion/hooks/useTimbrarRep.ts`: tras `onSuccess`, llamar `supabase.functions.invoke('facturapi-enviar-email', { body: { pago_id } })` de forma **fire-and-forget** con `notifyInfo` de resultado; los errores caen a `notifyWarning` sin bloquear el toast de éxito. Documentar que el envío es best-effort (el usuario puede reenviar manual).

**Tests:** actualizar `queries.test.ts` para las nuevas columnas + un test conductual del hook que verifica que se llame `functions.invoke` con `{ pago_id }`.

---

## QW3 · Badge "Enviada" en Emitidas

**Problema:** ya escribimos `enviada_cliente_at` al enviar, pero la tabla de Emitidas no lo distingue.

**Cambios:**

- `src/features/facturacion/routes/facturacionColumns.tsx`: en la columna `estado` (o adyacente), agregar un pequeño chip secundario **"Enviada"** (variant `outline`, ícono `Send`) cuando `enviada_cliente_at` no sea `null` y el estado sea `Vigente/Cobrada/Vencida`. Tooltip: `Enviada el {formatFechaHora}`.
- Añadir a `Factura` type/select si falta (verificar `useFacturas` select).
- Filtro opcional en `FacturasFilters` (checkbox "Sólo no enviadas") — sólo si el archivo de filtros lo permite en <1 diff.

**Tests:** snapshot/unit de la columna con dos casos (con/sin fecha).

---

## QW4 · Columna Archivos visible desde ≥lg

**Problema:** `facturacionColumns.tsx:96` esconde la columna `archivos` con `hidden xl:table-cell`.

**Cambios:**

- Cambiar `hidden xl:table-cell` → `hidden lg:table-cell` en la meta de la columna `archivos` (dos ocurrencias: `className` y `headerClassName`).
- Verificar densidad: si en `lg` (1024px) la fila se rompe, mover expediente/proforma a `hidden xl:` (ya lo están) y dejar archivos en `lg`. Confirmar visualmente con Playwright a 1280×1800.

---

## Versionado, changelog y verificación

- Bump `APP_VERSION` a **13.312.26** en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` bajo `## [13.312.26] - 2026-07-25` con 4 bullets breves (uno por QW) referenciando el doc `quickwins-facturacion-2026-07-24.md`.
- CI: `bun run lint -- --max-warnings 0` + tests unitarios afectados. Playwright: capturar `/facturacion` a 1080p para confirmar la columna Archivos en laptop.

---

## Detalles técnicos (no-user-facing)

- `ExportActions` pasa a `"use client"`-friendly (ya lo es, sólo hooks); mantener `TooltipProvider` para el caso deshabilitado (PDF requiere 1 solo cliente).
- La firma exacta de `generarEstadoCuentaPdf` la resuelvo al abrir el archivo en build; probablemente pide `{cliente, facturas, rangoFechas}` y lo alimento con `useEstadoCuenta` + un fetch adicional de cabecera de cliente (RFC/dirección) si el hook no lo trae.
- Auto-envío REP: usar `pago_id` (no `factura_id`) para que la edge tome la ruta REP y adjunte PDF+XML del complemento.
- `enviada_cliente_at` ya está en `facturas`; sólo hay que asegurarse de seleccionarlo en el listado. No requiere migración.

---

## Fuera de alcance

- Wizard/RHF migrations (Ola 1 estructural).
- QW5–QW12 (Tandas 2 y 3).
- Nuevos endpoints / edge functions.
- Cambios en el layout general del módulo.

¿Aprobado? Al pasar a build ejecuto los 4 QW en un solo turno, con tests y bump de versión.

Quita el git ignore 