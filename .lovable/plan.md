# Pendientes Auditoría Ronda 3 (v13.353.0)

Ya cerrados: R-01, R-02, R-03, R-04, R-08 (UI), R-09, R-10, R-13, R-15.1, R-15.2, y parte de R-05 y R-07 (`sanitizeToastText.ts` existe).

## Lo que falta

### 1. R-05 — Cargas infinitas (parcial)
- Aplicar `LoadingState` con timeout + Reintentar en las rutas que aún no lo tienen: `/embarques`, `/cotizaciones/nueva`, `/compras/facturas/nueva`, `/portal/cotizaciones`.
- Ruta sin permiso (`/compras/facturas/nueva` para tesorero): resolver el rol antes de disparar queries y mostrar "No tienes permiso para esta sección" en lugar de skeleton.
- Detalle de cotización (app y portal) con 0 filas: mostrar "Cotización no encontrada".

### 2. R-06 — Empty-state falso en /cotizaciones
- KPIs y tabla deben salir de la misma query.
- Mostrar vacío sólo con `isSuccess && data.length === 0`; durante `isError`, banner con Reintentar.

### 3. R-07 — Errores no sanitizados (cerrar el circuito)
- Verificar que `sanitizeToastText` se aplique en TODAS las rutas de error (cliente HTTP y `appFeedback`), no sólo donde ya se usa.
- Auditar mutaciones que llaman `notifyError` sin pasar `error` y corregirlas.
- `ejecutar_pago_programado` y guardado del wizard: mostrar el `error.message` real de PostgREST.

### 4. R-08 — Guarda server-side de cotización $0
- No existe validación en base: agregar en la RPC/trigger de envío `if v_total <= 0 then raise exception ...`.
- Test de que ventas no tiene acción "Aceptar".

### 5. R-11 — RBAC /embarques vs menú de ventas
- Decidir y documentar: quitar `ejecutivo_pricing` del guard de `/embarques` (redirect con toast) o agregar la entrada al menú de ventas.

### 6. R-12 — Navegación
- Deep link: preservar la ruta solicitada tras el login y redirigir a ella.
- Verificar que ya no haya flash de sidebar/layout (Fase 3 lo mitigó; confirmar en E2E).

### 7. R-14 — Dígitos en nombres de tablas
- Revisar `src/lib/formatters/text.ts` (regex que recorta dígitos finales) y su uso en tablas de proveedores/CxP.
- Test: "Logística Auditoría R3 SA de CV" se renderiza idéntico.

### 8. R-15 — UX miscelánea restante
- 15.3 Export PDF de estado de cuenta sin movimientos: toast "No hay movimientos en el periodo seleccionado".
- 15.4 `/admin/diagnostico`: empty-states reales en vez de skeletons perpetuos.
- 15.5 Toast "Ver detalles": evitar el solape de hit-area con el org-switcher (z-index/pointer-events).
- 15.6 Copy de error en mutaciones: "No se pudo completar la acción" + causa.

### 9. R-16 — Re-test (no es fix)
E2E de: matching de tarifas en wizard, circuito portal → envío → aceptación → embarque, ejecución de pago programado, aprobación de factura con conceptos y timbrado.

## Detalles técnicos
- Migración SQL nueva para R-08 (guarda de total) con `DROP ... IF EXISTS` previo (regla H4).
- Tests unitarios por cada fix y specs Playwright para R-16.
- Actualizar `CHANGELOG.md` y `APP_VERSION` al cerrar cada ola.
